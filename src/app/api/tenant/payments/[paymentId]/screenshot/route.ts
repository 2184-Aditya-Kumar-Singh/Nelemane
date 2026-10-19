import { Types } from "mongoose";

import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PaymentModel } from "@/server/db/models/payment";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ paymentId: string }> }) {
  try {
    const { user, tenant, pgId } = await requireActiveTenant();
    const { paymentId } = await context.params;
    if (!Types.ObjectId.isValid(paymentId)) return Response.json({ error: { message: "Payment screenshot was not found" } }, { status: 404 });
    await connectToDatabase();
    const payment = await PaymentModel.findOne({ _id: paymentId, pgId, tenantId: tenant._id }).select("screenshot month").lean();
    if (!payment?.screenshot) return Response.json({ error: { message: "Payment screenshot was not found" } }, { status: 404 });
    const imageResponse = await privateImageResponse(payment.screenshot.publicId);
    if (!imageResponse.ok) return imageResponse;
    await AuditLogModel.create({ actorId: new Types.ObjectId(user.id), action: "OWN_PAYMENT_PROOF_VIEWED", entity: "Payment", entityId: payment._id, meta: { pgId, tenantId: tenant._id.toString(), month: payment.month } });
    return imageResponse;
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Payment screenshot could not be opened" } }, { status: 500 });
  }
}
