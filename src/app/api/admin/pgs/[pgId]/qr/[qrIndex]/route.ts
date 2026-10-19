import { Types } from "mongoose";

import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel, type PgQrAccount } from "@/server/db/models/pg";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ pgId: string; qrIndex: string }> }) {
  try {
    await requireRoles("SUPER_ADMIN");
    const { pgId, qrIndex } = await context.params;
    const index = Number(qrIndex);
    if (!Types.ObjectId.isValid(pgId) || !Number.isInteger(index) || index < 0 || index > 4) {
      return Response.json({ error: { message: "Payment QR was not found" } }, { status: 404 });
    }

    await connectToDatabase();
    const pg = await PgModel.findById(pgId).select("owner.name paymentDetails").lean();
    if (!pg) return Response.json({ error: { message: "Payment QR was not found" } }, { status: 404 });

    const details = pg.paymentDetails;
    const qrAccounts: PgQrAccount[] = details.qrAccounts?.length
      ? details.qrAccounts
      : details.qrImage
        ? [{ accountHolderName: pg.owner.name, upiId: details.upiId ?? "", qrImage: details.qrImage }]
        : [];
    const account = qrAccounts[index];
    if (!account) return Response.json({ error: { message: "Payment QR was not found" } }, { status: 404 });

    return privateImageResponse(account.qrImage.publicId);
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Payment QR could not be opened" } }, { status: 500 });
  }
}
