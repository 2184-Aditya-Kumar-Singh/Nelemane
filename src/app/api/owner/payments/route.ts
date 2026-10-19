import mongoose, { Types } from "mongoose";

import { ownerRecordPaymentSchema } from "@/lib/payment-schemas";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PaymentModel, type PaymentStatus } from "@/server/db/models/payment";
import { PgModel } from "@/server/db/models/pg";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { RoomModel } from "@/server/db/models/room";
import { RoomTypeModel } from "@/server/db/models/room-type";
import { TenantModel } from "@/server/db/models/tenant";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { emailPaymentReceipt } from "@/server/payments/notifications";
import { getIstMonthKey } from "@/server/payments/dates";
import { paymentDateFromIst } from "@/server/payments/dates";
import { deriveChargeStatus } from "@/server/payments/logic";
import { revalidatePaymentViews } from "@/server/payments/revalidate";
import { resolveOwnerPhotoReference } from "@/server/owner/asset-references";

export const runtime = "nodejs";

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function GET(request: Request) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    await connectToDatabase();
    const params = new URL(request.url).searchParams;
    const requestedStatus = params.get("status")?.toUpperCase() ?? "PENDING";
    if (!["PENDING", "APPROVED", "REJECTED"].includes(requestedStatus)) return Response.json({ error: { message: "Choose a valid payment status" } }, { status: 400 });
    const status = requestedStatus as Exclude<PaymentStatus, "CANCELLED">;
    const payments = await PaymentModel.find({ pgId, source: "TENANT", status: { $in: [status] } }).sort({ createdAt: status === "PENDING" ? 1 : -1 }).limit(500).lean();
    const tenantIds = payments.map((payment) => payment.tenantId);
    const tenants = await TenantModel.find({ _id: { $in: tenantIds }, pgId }).select("name email phone roomId").lean();
    const tenantMap = new Map(tenants.map((tenant) => [tenant._id.toString(), tenant]));
    const rooms = await RoomModel.find({ _id: { $in: tenants.map((tenant) => tenant.roomId) }, pgId }).select("roomNumber floor block roomTypeId").lean();
    const roomMap = new Map(rooms.map((room) => [room._id.toString(), room]));
    const roomTypes = await RoomTypeModel.find({ _id: { $in: rooms.map((room) => room.roomTypeId) }, pgId }).select("name").lean();
    const roomTypeMap = new Map(roomTypes.map((roomType) => [roomType._id.toString(), roomType.name]));
    const charges = await RentChargeModel.find({ _id: { $in: payments.map((payment) => payment.chargeId) }, pgId }).select("amount paidAmount").lean();
    const chargeMap = new Map(charges.map((charge) => [charge._id.toString(), charge]));
    const transactionIds = [...new Set(payments.map((payment) => payment.transactionId).filter((transactionId): transactionId is string => Boolean(transactionId)))];
    const transactions = transactionIds.length ? await PaymentModel.find({ pgId, transactionId: { $in: transactionIds } }).select("transactionId").lean() : [];
    const transactionCounts = new Map<string, number>();
    for (const payment of transactions) if (payment.transactionId) transactionCounts.set(payment.transactionId, (transactionCounts.get(payment.transactionId) ?? 0) + 1);
    const result = payments.map((payment) => {
      const tenant = tenantMap.get(payment.tenantId.toString());
      const room = tenant ? roomMap.get(tenant.roomId.toString()) : null;
      const charge = chargeMap.get(payment.chargeId.toString());
      return {
        id: payment._id.toString(), tenantId: payment.tenantId.toString(), chargeId: payment.chargeId.toString(),
        month: payment.month, status: payment.status, source: payment.source, mode: payment.mode,
        transactionId: payment.transactionId ?? "", transactionDate: payment.transactionDate.toISOString(),
        amountSubmittedPaise: payment.amountSubmitted, approvedAmountPaise: payment.approvedAmount ?? null,
        dueAmountPaise: charge ? Math.max(0, charge.amount - charge.paidAmount) : 0,
        duplicateTransaction: Boolean(payment.transactionId && (transactionCounts.get(payment.transactionId) ?? 0) > 1),
        transactionMonthOlderThanCharge: getIstMonthKey(payment.transactionDate) < payment.month,
        payerDiffersFromTenant: Boolean(tenant && payment.payerName.trim().toLowerCase() !== tenant.name.trim().toLowerCase()),
        payerName: payment.payerName, recipientAccountName: payment.recipientAccountName ?? "", note: payment.note ?? "", rejectionReason: payment.rejectionReason ?? "",
        createdAt: payment.createdAt.toISOString(), hasScreenshot: Boolean(payment.screenshot),
        tenant: { name: tenant?.name ?? "Former tenant", email: tenant?.email ?? "", phone: tenant?.phone ?? "" },
        room: room ? { number: room.roomNumber, floor: room.floor, block: room.block ?? "", type: roomTypeMap.get(room.roomTypeId.toString()) ?? "" } : null,
      };
    });
    return Response.json({ payments: result });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Payments could not be loaded" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const parsed = ownerRecordPaymentSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Review the payment details", fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } }, { status: 400 });
    await connectToDatabase();
    const transactionId = parsed.data.transactionId || undefined;
    if (transactionId && await PaymentModel.exists({ pgId, transactionId, status: { $in: ["PENDING", "APPROVED"] } })) {
      return Response.json({ error: { message: "This transaction ID is already pending or approved in this PG" } }, { status: 409 });
    }
    const session = await mongoose.startSession();
    let notice: { tenantName: string; tenantEmail: string; pgName: string; month: string; id: string } | undefined;
    try {
      notice = await session.withTransaction(async () => {
        const charge = await RentChargeModel.findOne({ _id: parsed.data.chargeId, pgId, tenantId: parsed.data.tenantId }).session(session);
        const tenant = await TenantModel.findOne({ _id: parsed.data.tenantId, pgId }).select("name email status").session(session).lean();
        const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name").session(session).lean();
        if (!charge || !tenant || !pg || tenant.status !== "ACTIVE") throw new Error("RECORD_CONTEXT_NOT_FOUND");
        if (charge.paidAmount >= charge.amount) throw new Error("CHARGE_ALREADY_PAID");
        if (await PaymentModel.exists({ chargeId: charge._id, status: "PENDING" }).session(session)) throw new Error("PAYMENT_PENDING");
        if (transactionId && await PaymentModel.exists({ pgId, transactionId, status: { $in: ["PENDING", "APPROVED"] } }).session(session)) throw new Error("TRANSACTION_ALREADY_USED");
        let screenshot: { publicId: string; resourceType: "image" | "raw" } | undefined;
        let uploadId: string | undefined;
        if (parsed.data.screenshot) {
          const upload = await resolveOwnerPhotoReference({ photo: parsed.data.screenshot, purpose: "OWNER_PAYMENT_PROOF", existing: [], ownerId: user.id, pgId, visibility: "private", session });
          screenshot = { publicId: upload.asset.publicId, resourceType: "image" };
          uploadId = upload.uploadedAssetId;
        }
        const paymentId = new Types.ObjectId();
        await PaymentModel.create([{
          _id: paymentId, pgId: new Types.ObjectId(pgId), tenantId: charge.tenantId, chargeId: charge._id,
          month: charge.month, source: "OWNER", mode: parsed.data.mode, transactionId,
          transactionDate: paymentDateFromIst(parsed.data.transactionDate), amountSubmitted: parsed.data.amountPaise,
          approvedAmount: parsed.data.amountPaise, payerName: parsed.data.payerName, note: parsed.data.note || undefined,
          screenshot, status: "APPROVED", reviewedBy: new Types.ObjectId(user.id), reviewedAt: new Date(),
        }], { session });
        if (uploadId) {
          const claim = await TemporaryAssetModel.updateOne({ _id: uploadId, ownerUserId: user.id, pgId, purpose: "OWNER_PAYMENT_PROOF", claimedAt: { $exists: false } }, { $set: { claimedAt: new Date() } }, { session });
          if (claim.modifiedCount !== 1) throw new Error("UPLOAD_NOT_AVAILABLE");
        }
        charge.paidAmount += parsed.data.amountPaise;
        const anotherPending = await PaymentModel.exists({ _id: { $ne: paymentId }, chargeId: charge._id, status: "PENDING" }).session(session);
        charge.status = deriveChargeStatus(charge, Boolean(anotherPending));
        await charge.save({ session });
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(user.id), action: "OWNER_PAYMENT_RECORDED", entity: "Payment", entityId: paymentId,
          meta: { pgId, tenantId: tenant._id.toString(), chargeId: charge._id.toString(), month: charge.month, amount: parsed.data.amountPaise, mode: parsed.data.mode },
        }], { session });
        return { tenantName: tenant.name, tenantEmail: tenant.email, pgName: pg.name, month: charge.month, id: paymentId.toString() };
      });
    } finally {
      await session.endSession();
    }
    if (!notice) throw new Error("RECORD_CONTEXT_NOT_FOUND");
    revalidatePaymentViews();
    await emailPaymentReceipt({ tenantName: notice.tenantName, tenantEmail: notice.tenantEmail, pgName: notice.pgName, paymentId: notice.id, month: notice.month, amountPaise: parsed.data.amountPaise, transactionId });
    return Response.json({ recorded: true, paymentId: notice.id }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "RECORD_CONTEXT_NOT_FOUND") return Response.json({ error: { message: "Tenant or rent charge is unavailable" } }, { status: 404 });
    if (error instanceof Error && error.message === "CHARGE_ALREADY_PAID") return Response.json({ error: { message: "This rent charge is already fully paid" } }, { status: 409 });
    if (error instanceof Error && error.message === "PAYMENT_PENDING") return Response.json({ error: { message: "Review the tenant's pending payment before recording another payment" } }, { status: 409 });
    if (error instanceof Error && error.message === "TRANSACTION_ALREADY_USED") return Response.json({ error: { message: "This transaction ID is already pending or approved in this PG" } }, { status: 409 });
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") return Response.json({ error: { message: "Payment proof upload expired; upload it again" } }, { status: 400 });
    if (isDuplicateKeyError(error)) return Response.json({ error: { message: "This transaction ID or payment record already exists" } }, { status: 409 });
    return Response.json({ error: { message: "Payment could not be recorded" } }, { status: 500 });
  }
}
