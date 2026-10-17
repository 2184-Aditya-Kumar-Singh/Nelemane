import { Types } from "mongoose";

import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PaymentModel } from "@/server/db/models/payment";
import { getStorageProvider } from "@/server/providers/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ paymentId: string }> }) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { paymentId } = await context.params;
    if (!Types.ObjectId.isValid(paymentId)) return Response.json({ error: { message: "Payment proof was not found" } }, { status: 404 });
    await connectToDatabase();
    const payment = await PaymentModel.findOne({ _id: paymentId, pgId, source: "TENANT" }).select("screenshot tenantId month").lean();
    if (!payment?.screenshot) return Response.json({ error: { message: "Payment proof was not found" } }, { status: 404 });
    const signedUrl = await getStorageProvider().getSignedUrl(payment.screenshot.publicId, 60);
    await AuditLogModel.create({ actorId: new Types.ObjectId(user.id), action: "PAYMENT_PROOF_VIEWED", entity: "Payment", entityId: payment._id, meta: { pgId, tenantId: payment.tenantId.toString(), month: payment.month } });
    return Response.json({ signedUrl, expiresInSeconds: 60 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Payment proof could not be opened" } }, { status: 500 });
  }
}
