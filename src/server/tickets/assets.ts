import "server-only";

import type mongoose from "mongoose";

import { TemporaryAssetModel, type UploadPurpose } from "@/server/db/models/temporary-asset";
import type { TicketImage } from "@/server/db/models/ticket";

export async function claimTicketImages(input: {
  assetIds: string[];
  purpose: Extract<UploadPurpose, "TICKET_IMAGE" | "OWNER_TICKET_PROOF">;
  ownerId: string;
  pgId: string;
  session: mongoose.ClientSession;
}): Promise<TicketImage[]> {
  const ids = [...new Set(input.assetIds)];
  if (ids.length !== input.assetIds.length) throw new Error("UPLOAD_NOT_AVAILABLE");
  if (!ids.length) return [];
  const assets = await TemporaryAssetModel.find({
    _id: { $in: ids }, ownerUserId: input.ownerId, pgId: input.pgId,
    purpose: input.purpose, visibility: "private", resourceType: "image",
    claimedAt: { $exists: false }, expiresAt: { $gt: new Date() },
  }).session(input.session).lean();
  if (assets.length !== ids.length) throw new Error("UPLOAD_NOT_AVAILABLE");
  const result = await TemporaryAssetModel.updateMany({
    _id: { $in: ids }, ownerUserId: input.ownerId, pgId: input.pgId,
    purpose: input.purpose, claimedAt: { $exists: false }, expiresAt: { $gt: new Date() },
  }, { $set: { claimedAt: new Date() } }, { session: input.session });
  if (result.modifiedCount !== ids.length) throw new Error("UPLOAD_NOT_AVAILABLE");
  return assets.map((asset) => ({ publicId: asset.publicId, resourceType: "image" as const }));
}
