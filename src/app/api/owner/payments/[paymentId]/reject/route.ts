import mongoose, { Types } from "mongoose";

import { paymentRejectionSchema } from "@/lib/payment-schemas";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PaymentModel } from "@/server/db/models/payment";
import { PgModel } from "@/server/db/models/pg";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { TenantModel } from "@/server/db/models/tenant";
import { emailPaymentRejection } from "@/server/payments/notifications";
import { deriveChargeStatus } from "@/server/payments/logic";
import { revalidatePaymentViews } from "@/server/payments/revalidate";

export async function POST(request: Request, context: { params: Promise<{ paymentId: string }> }) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { paymentId } = await context.params;
    if (!Types.ObjectId.isValid(paymentId)) return Response.json({ error: { message: "Payment was not found" } }, { status: 404 });
    const parsed = paymentRejectionSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Enter a rejection reason" } }, { status: 400 });
    await connectToDatabase();
    const session = await mongoose.startSession();
    let notification: { tenantName: string; tenantEmail: string; pgName: string; month: string } | undefined;
    try {
      notification = await session.withTransaction(async () => {
        const payment = await PaymentModel.findOne({ _id: paymentId, pgId, source: "TENANT" }).session(session);
        if (!payment) throw new Error("PAYMENT_NOT_FOUND");
        if (payment.status !== "PENDING") throw new Error("PAYMENT_NOT_PENDING");
        const charge = await RentChargeModel.findOne({ _id: payment.chargeId, pgId, tenantId: payment.tenantId }).session(session);
        const tenant = await TenantModel.findOne({ _id: payment.tenantId, pgId }).select("name email").session(session).lean();
        const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name").session(session).lean();
        if (!charge || !tenant || !pg) throw new Error("PAYMENT_CONTEXT_NOT_FOUND");

        payment.status = "REJECTED";
        payment.rejectionReason = parsed.data.reason;
        payment.reviewedBy = new Types.ObjectId(user.id);
        payment.reviewedAt = new Date();
        await payment.save({ session });
        const anotherPending = await PaymentModel.exists({ _id: { $ne: payment._id }, chargeId: charge._id, status: "PENDING" }).session(session);
        charge.status = deriveChargeStatus(charge, Boolean(anotherPending));
        await charge.save({ session });
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(user.id), action: "PAYMENT_REJECTED", entity: "Payment", entityId: payment._id,
          meta: { pgId, tenantId: payment.tenantId.toString(), chargeId: charge._id.toString(), month: payment.month, reason: parsed.data.reason },
        }], { session });
        return { tenantName: tenant.name, tenantEmail: tenant.email, pgName: pg.name, month: payment.month };
      });
    } finally {
      await session.endSession();
    }
    if (!notification) throw new Error("PAYMENT_CONTEXT_NOT_FOUND");
    revalidatePaymentViews();
    const email = await emailPaymentRejection({ ...notification, paymentId, reason: parsed.data.reason });
    return Response.json({ rejected: true, tenantEmail: email.status });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "PAYMENT_NOT_FOUND") return Response.json({ error: { message: "Payment was not found" } }, { status: 404 });
    if (error instanceof Error && error.message === "PAYMENT_NOT_PENDING") return Response.json({ error: { message: "This payment has already been reviewed" } }, { status: 409 });
    if (error instanceof Error && error.message === "PAYMENT_CONTEXT_NOT_FOUND") return Response.json({ error: { message: "Payment or rent charge context is unavailable" } }, { status: 404 });
    return Response.json({ error: { message: "Payment could not be rejected" } }, { status: 500 });
  }
}
