import { Types } from "mongoose";

import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { TemporaryAssetModel, type UploadPurpose } from "@/server/db/models/temporary-asset";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const { user, pgId } = await requireActiveTenant();
    const { assetId } = await context.params;
    if (!Types.ObjectId.isValid(assetId)) return Response.json({ error: { message: "Image was not found" } }, { status: 404 });
    const purpose = new URL(request.url).searchParams.get("purpose");
    const allowedPurposes: UploadPurpose[] = purpose === "TICKET_IMAGE" || purpose === "TENANT_PROFILE" ? [purpose] : ["TENANT_PAYMENT_SCREENSHOT"];
    const asset = await TemporaryAssetModel.findOne({
      _id: assetId, ownerUserId: user.id, pgId, purpose: { $in: allowedPurposes }, visibility: "private",
      claimedAt: { $exists: false }, expiresAt: { $gt: new Date() },
    }).lean();
    if (!asset) return Response.json({ error: { message: "Image was not found" } }, { status: 404 });
    return privateImageResponse(asset.publicId);
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "The image could not be opened" } }, { status: 500 });
  }
}
