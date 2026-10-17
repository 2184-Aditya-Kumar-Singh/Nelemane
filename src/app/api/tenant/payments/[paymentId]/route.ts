import { Types } from "mongoose";

import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PaymentModel } from "@/server/db/models/payment";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { deriveChargeStatus } from "@/server/payments/logic";
import { revalidatePaymentViews } from "@/server/payments/revalidate";

export async function DELETE(request: Request, context: { params: Promise<{ paymentId: string }> }) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const { user, tenant, pgId } = await requireActiveTenant();
    const { paymentId } = await context.params;
    if (!Types.ObjectId.isValid(paymentId)) return Response.json({ error: { message: "Payment was not found" } }, { status: 404 });
    await connectToDatabase();
    const mongoose = await import("mongoose");
    const session = await mongoose.default.startSession();
    try {
      await session.withTransaction(async () => {
        const payment = await PaymentModel.findOne({ _id: paymentId, pgId, tenantId: tenant._id, source: "TENANT" }).session(session);
        if (!payment) throw new Error("PAYMENT_NOT_FOUND");
        if (payment.status !== "PENDING") throw new Error("PAYMENT_NOT_PENDING");
        const charge = await RentChargeModel.findOne({ _id: payment.chargeId, pgId, tenantId: tenant._id }).session(session);
        if (!charge) throw new Error("CHARGE_NOT_FOUND");
        payment.status = "CANCELLED";
        payment.reviewedAt = new Date();
        await payment.save({ session });
        const anotherPending = await PaymentModel.exists({ _id: { $ne: payment._id }, chargeId: charge._id, status: "PENDING" }).session(session);
        charge.status = deriveChargeStatus(charge, Boolean(anotherPending));
        await charge.save({ session });
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(user.id), action: "TENANT_PAYMENT_CANCELLED", entity: "Payment", entityId: payment._id,
          meta: { pgId, tenantId: tenant._id.toString(), chargeId: charge._id.toString(), month: payment.month },
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    revalidatePaymentViews();
    return Response.json({ cancelled: true });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "PAYMENT_NOT_FOUND") return Response.json({ error: { message: "Payment was not found" } }, { status: 404 });
    if (error instanceof Error && error.message === "PAYMENT_NOT_PENDING") return Response.json({ error: { message: "Only pending payments can be cancelled" } }, { status: 409 });
    if (error instanceof Error && error.message === "CHARGE_NOT_FOUND") return Response.json({ error: { message: "Rent charge was not found" } }, { status: 404 });
    return Response.json({ error: { message: "Payment could not be cancelled" } }, { status: 500 });
  }
}
