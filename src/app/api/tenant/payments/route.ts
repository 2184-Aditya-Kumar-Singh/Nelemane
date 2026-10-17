import mongoose, { Types } from "mongoose";

import { tenantPaymentInputSchema } from "@/lib/payment-schemas";
import { escapeHtml } from "@/server/admin/serializers";
import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { PaymentModel } from "@/server/db/models/payment";
import { PaymentSubmissionQuotaModel } from "@/server/db/models/payment-submission-quota";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { getIstDateParts, istMidnightUtc, paymentDateFromIst } from "@/server/payments/dates";
import { resolveOwnerPhotoReference } from "@/server/owner/asset-references";
import { sendEmailOnce } from "@/server/notifications/send-once";

export const runtime = "nodejs";

function isDuplicateKeyError(error: unknown): error is { code: number; keyPattern?: Record<string, unknown> } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function transactionDateError(dateKey: string): string | null {
  const today = getIstDateParts().key;
  if (dateKey > today) return "Transaction date cannot be in the future";
  const cutoff = new Date(istMidnightUtc(today).getTime() - 60 * 24 * 60 * 60 * 1000);
  if (paymentDateFromIst(dateKey) < cutoff) return "Transaction date cannot be older than 60 days";
  return null;
}

export async function GET() {
  try {
    const { tenant, pgId } = await requireActiveTenant();
    await connectToDatabase();
    const charges = await RentChargeModel.find({ pgId, tenantId: tenant._id }).sort({ month: -1 }).limit(24).lean();
    const payments = await PaymentModel.find({ pgId, tenantId: tenant._id }).sort({ createdAt: -1 }).limit(100).lean();
    return Response.json({
      charges: charges.map((charge) => ({
        id: charge._id.toString(), month: charge.month, amountPaise: charge.amount, paidAmountPaise: charge.paidAmount,
        dueAmountPaise: Math.max(0, charge.amount - charge.paidAmount), status: charge.status,
        windowStart: charge.windowStart.toISOString(), windowEnd: charge.windowEnd.toISOString(),
      })),
      payments: payments.map((payment) => ({
        id: payment._id.toString(), chargeId: payment.chargeId.toString(), month: payment.month, source: payment.source,
        mode: payment.mode, transactionId: payment.transactionId ?? "", transactionDate: payment.transactionDate.toISOString(),
        amountSubmittedPaise: payment.amountSubmitted, approvedAmountPaise: payment.approvedAmount ?? null,
        payerName: payment.payerName, note: payment.note ?? "", status: payment.status,
        rejectionReason: payment.rejectionReason ?? "", hasScreenshot: Boolean(payment.screenshot), createdAt: payment.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Rent history could not be loaded" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  let tenantName = "";
  let pgName = "";
  let ownerEmail = "";
  let paymentId = "";
  let transactionId = "";
  try {
    const { user, tenant, pgId } = await requireActiveTenant();
    const parsed = tenantPaymentInputSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Review the payment details", fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } }, { status: 400 });
    const invalidDate = transactionDateError(parsed.data.transactionDate);
    if (invalidDate) return Response.json({ error: { message: invalidDate } }, { status: 400 });

    await connectToDatabase();
    const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name owner.email").lean();
    if (!pg) return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    pgName = pg.name;
    ownerEmail = pg.owner.email;
    tenantName = tenant.name;
    transactionId = parsed.data.transactionId;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const charge = await RentChargeModel.findOne({ _id: parsed.data.chargeId, pgId, tenantId: tenant._id }).session(session);
        if (!charge) throw new Error("CHARGE_NOT_FOUND");
        if (charge.status === "PAID" || charge.paidAmount >= charge.amount) throw new Error("CHARGE_ALREADY_PAID");
        const existingPending = await PaymentModel.exists({ chargeId: charge._id, status: "PENDING" }).session(session);
        if (existingPending) throw new Error("PAYMENT_ALREADY_PENDING");
        if (await PaymentModel.exists({ pgId, transactionId, status: { $in: ["PENDING", "APPROVED"] } }).session(session)) throw new Error("TRANSACTION_ALREADY_USED");

        const dayKey = getIstDateParts().key;
        let quota = await PaymentSubmissionQuotaModel.findOneAndUpdate(
          { tenantId: tenant._id, dayKey, count: { $lt: 10 } }, { $inc: { count: 1 } }, { new: true, session },
        );
        if (!quota) {
          if (await PaymentSubmissionQuotaModel.exists({ tenantId: tenant._id, dayKey }).session(session)) throw new Error("DAILY_PAYMENT_LIMIT");
          const createdQuota = await PaymentSubmissionQuotaModel.create([{ tenantId: tenant._id, dayKey, count: 1 }], { session });
          quota = createdQuota[0] ?? null;
        }
        if (!quota) throw new Error("DAILY_PAYMENT_LIMIT");

        const screenshot = await resolveOwnerPhotoReference({
          photo: parsed.data.screenshot, purpose: "TENANT_PAYMENT_SCREENSHOT", existing: [], ownerId: user.id,
          pgId, visibility: "private", session,
        });
        const payment = await PaymentModel.create([{
          pgId: new Types.ObjectId(pgId), tenantId: tenant._id, chargeId: charge._id, month: charge.month,
          source: "TENANT", mode: parsed.data.mode, transactionId, transactionDate: paymentDateFromIst(parsed.data.transactionDate),
          amountSubmitted: parsed.data.amountPaise, payerName: parsed.data.payerName, note: parsed.data.note || undefined,
          screenshot: { publicId: screenshot.asset.publicId, resourceType: "image" }, status: "PENDING",
        }], { session });
        paymentId = payment[0]!._id.toString();
        await TemporaryAssetModel.updateOne(
          { _id: screenshot.uploadedAssetId, ownerUserId: user.id, pgId, purpose: "TENANT_PAYMENT_SCREENSHOT", claimedAt: { $exists: false } },
          { $set: { claimedAt: new Date() } }, { session },
        ).then((result) => { if (result.modifiedCount !== 1) throw new Error("UPLOAD_NOT_AVAILABLE"); });
        charge.status = "PENDING_VERIFICATION";
        await charge.save({ session });
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(user.id), action: "PAYMENT_SUBMITTED", entity: "Payment", entityId: payment[0]!._id,
          meta: { pgId, tenantId: tenant._id.toString(), chargeId: charge._id.toString(), month: charge.month, amountSubmitted: parsed.data.amountPaise, mode: parsed.data.mode },
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(parsed.data.amountPaise / 100);
    const message = `${tenantName} submitted a ${amount} payment for ${pgName}. Transaction ${transactionId}. Review it in Payment Verifications.`;
    const notification = await sendEmailOnce({
      to: ownerEmail, template: "payment-submitted-to-owner", dedupeKey: `payment-submitted-${paymentId}`,
      subject: `Payment needs verification: ${tenantName} · ${pgName}`,
      text: message, html: `<p>${escapeHtml(message)}</p>`,
    });
    return Response.json({ payment: { id: paymentId, status: "PENDING" }, ownerNotification: notification.status }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "CHARGE_NOT_FOUND") return Response.json({ error: { message: "This rent charge was not found" } }, { status: 404 });
    if (error instanceof Error && error.message === "CHARGE_ALREADY_PAID") return Response.json({ error: { message: "This rent charge is already paid" } }, { status: 409 });
    if (error instanceof Error && error.message === "PAYMENT_ALREADY_PENDING") return Response.json({ error: { message: "A payment is already awaiting approval for this charge" } }, { status: 409 });
    if (error instanceof Error && error.message === "TRANSACTION_ALREADY_USED") return Response.json({ error: { message: "This transaction ID is already pending or approved in this PG" } }, { status: 409 });
    if (error instanceof Error && error.message === "DAILY_PAYMENT_LIMIT") return Response.json({ error: { message: "You have reached the limit of 10 payment submissions today" } }, { status: 429 });
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") return Response.json({ error: { message: "The payment screenshot expired; upload it again" } }, { status: 400 });
    if (isDuplicateKeyError(error)) {
      return error.keyPattern?.transactionId
        ? Response.json({ error: { message: "This transaction ID is already pending or approved in this PG" } }, { status: 409 })
        : Response.json({ error: { message: "Payment submissions are processing; please try again" } }, { status: 429 });
    }
    return Response.json({ error: { message: "Payment could not be submitted" } }, { status: 500 });
  }
}
