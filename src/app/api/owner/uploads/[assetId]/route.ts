import { Types } from "mongoose";

import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { getStorageProvider } from "@/server/providers/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { assetId } = await context.params;
    if (!Types.ObjectId.isValid(assetId)) return Response.json({ error: { message: "Image was not found" } }, { status: 404 });
    await connectToDatabase();
    const asset = await TemporaryAssetModel.findOne({
      _id: assetId,
      ownerUserId: user.id,
      pgId,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!asset) return Response.json({ error: { message: "Image was not found" } }, { status: 404 });
    if (asset.purpose === "TENANT_AADHAAR" && asset.claimedAt) return Response.json({ error: { message: "Open Aadhaar documents from the tenant detail page" } }, { status: 404 });
    const previewUrl = asset.visibility === "private"
      ? await getStorageProvider().getSignedUrl(asset.publicId, 60)
      : asset.url;
    if (asset.purpose === "TENANT_AADHAAR") {
      await AuditLogModel.create({ actorId: new Types.ObjectId(user.id), action: "TENANT_AADHAAR_UPLOAD_PREVIEWED", entity: "TemporaryAsset", entityId: asset._id, meta: { pgId, access: "signed-url-issued" } });
    }
    return Response.json({ asset: { id: asset._id.toString(), purpose: asset.purpose, previewUrl } });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "The image could not be opened" } }, { status: 500 });
  }
}
