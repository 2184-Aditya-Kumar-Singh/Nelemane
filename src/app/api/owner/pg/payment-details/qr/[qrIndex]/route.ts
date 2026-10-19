import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel, type PgQrAccount } from "@/server/db/models/pg";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ qrIndex: string }> }) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { qrIndex } = await context.params;
    const index = Number(qrIndex);
    if (!Number.isInteger(index) || index < 0 || index > 4) {
      return Response.json({ error: { message: "Payment QR was not found" } }, { status: 404 });
    }

    await connectToDatabase();
    const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("owner.name paymentDetails").lean();
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
