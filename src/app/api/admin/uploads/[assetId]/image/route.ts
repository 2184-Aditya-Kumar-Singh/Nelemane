import { Types } from "mongoose";

import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const admin = await requireRoles("SUPER_ADMIN");
    const { assetId } = await context.params;
    if (!Types.ObjectId.isValid(assetId)) return Response.json({ error: { message: "Image was not found" } }, { status: 404 });
    await connectToDatabase();
    const asset = await TemporaryAssetModel.findOne({ _id: assetId, ownerUserId: admin.id, visibility: "private", expiresAt: { $gt: new Date() } }).lean();
    if (!asset) return Response.json({ error: { message: "Image was not found" } }, { status: 404 });
    return privateImageResponse(asset.publicId);
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "The image could not be opened" } }, { status: 500 });
  }
}
