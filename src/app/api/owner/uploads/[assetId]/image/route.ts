import { Types } from "mongoose";

import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { assetId } = await context.params;
    if (!Types.ObjectId.isValid(assetId)) return Response.json({ error: { message: "Image was not found" } }, { status: 404 });
    await connectToDatabase();
    const asset = await TemporaryAssetModel.findOne({ _id: assetId, ownerUserId: user.id, pgId, visibility: "private", expiresAt: { $gt: new Date() } }).lean();
    if (!asset) return Response.json({ error: { message: "Image was not found" } }, { status: 404 });
    if (asset.purpose === "TENANT_AADHAAR" && asset.claimedAt) return Response.json({ error: { message: "Open Aadhaar documents from the tenant detail page" } }, { status: 404 });
    if (asset.purpose === "TENANT_AADHAAR") {
      await AuditLogModel.create({ actorId: new Types.ObjectId(user.id), action: "TENANT_AADHAAR_UPLOAD_PREVIEWED", entity: "TemporaryAsset", entityId: asset._id, meta: { pgId, access: "same-origin-image" } });
    }
    return privateImageResponse(asset.publicId);
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "The image could not be opened" } }, { status: 500 });
  }
}
