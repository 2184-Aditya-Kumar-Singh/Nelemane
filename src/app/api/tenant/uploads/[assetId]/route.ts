import { Types } from "mongoose";

import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { TemporaryAssetModel, type UploadPurpose } from "@/server/db/models/temporary-asset";
import { getStorageProvider } from "@/server/providers/storage";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const { user, pgId } = await requireActiveTenant();
    const { assetId } = await context.params;
    if (!Types.ObjectId.isValid(assetId)) return Response.json({ error: { message: "Screenshot was not found" } }, { status: 404 });
    const purpose = new URL(_request.url).searchParams.get("purpose");
    const allowedPurposes: UploadPurpose[] = purpose === "TICKET_IMAGE" || purpose === "TENANT_PROFILE" ? [purpose] : ["TENANT_PAYMENT_SCREENSHOT"];
    const asset = await TemporaryAssetModel.findOne({
      _id: assetId, ownerUserId: user.id, pgId, purpose: { $in: allowedPurposes }, visibility: "private",
      claimedAt: { $exists: false }, expiresAt: { $gt: new Date() },
    }).lean();
    if (!asset) return Response.json({ error: { message: "Screenshot was not found" } }, { status: 404 });
    return Response.json({ previewUrl: await getStorageProvider().getSignedUrl(asset.publicId, 60), expiresInSeconds: 60 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Screenshot could not be opened" } }, { status: 500 });
  }
}
