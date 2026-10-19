import { Types } from "mongoose";

import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel } from "@/server/db/models/pg";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ chargeId: string; qrIndex: string }> }) {
  try {
    const { tenant, pgId } = await requireActiveTenant();
    const { chargeId, qrIndex } = await context.params;
    const index = Number(qrIndex);
    if (!Types.ObjectId.isValid(chargeId) || !Number.isInteger(index) || index < 0 || index > 4) {
      return Response.json({ error: { message: "Payment QR was not found" } }, { status: 404 });
    }

    await connectToDatabase();
    const [charge, pg] = await Promise.all([
      RentChargeModel.findOne({ _id: chargeId, pgId, tenantId: tenant._id }).select("_id").lean(),
      PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("owner.name paymentDetails").lean(),
    ]);
    if (!charge || !pg) return Response.json({ error: { message: "Payment QR was not found" } }, { status: 404 });

    const details = pg.paymentDetails;
    const qrAccounts = details.qrAccounts?.length
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
