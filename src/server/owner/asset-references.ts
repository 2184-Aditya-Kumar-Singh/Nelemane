import "server-only";

import type mongoose from "mongoose";

import type { ownerPhotoReferenceSchema } from "@/lib/owner-schemas";
import type { PgAsset } from "@/server/db/models/pg";
import { TemporaryAssetModel, type UploadPurpose } from "@/server/db/models/temporary-asset";

export type OwnerPhotoReference = typeof ownerPhotoReferenceSchema._output;

export async function resolveOwnerPhotoReference(input: {
  photo: OwnerPhotoReference;
  purpose: UploadPurpose;
  existing: PgAsset[];
  ownerId: string;
  pgId: string;
  visibility: "public" | "private";
  session: mongoose.ClientSession;
}): Promise<{ asset: PgAsset; uploadedAssetId?: string }> {
  if (input.photo.assetId) {
    const upload = await TemporaryAssetModel.findOne({
      _id: input.photo.assetId,
      ownerUserId: input.ownerId,
      pgId: input.pgId,
      purpose: input.purpose,
      visibility: input.visibility,
      claimedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }).session(input.session).lean();
    if (!upload) throw new Error("UPLOAD_NOT_AVAILABLE");
    return {
      asset: { url: upload.url, publicId: upload.publicId },
      uploadedAssetId: upload._id.toString(),
    };
  }

  const existing = input.existing.find((asset) => asset.publicId === input.photo.publicId);
  if (!existing) throw new Error("PHOTO_NOT_AVAILABLE");
  return { asset: existing };
}

export async function claimOwnerUploads(input: {
  ids: Set<string>;
  ownerId: string;
  pgId: string;
  session: mongoose.ClientSession;
}): Promise<void> {
  for (const id of input.ids) {
    const result = await TemporaryAssetModel.updateOne(
      { _id: id, ownerUserId: input.ownerId, pgId: input.pgId, claimedAt: { $exists: false } },
      { $set: { claimedAt: new Date() } },
      { session: input.session },
    );
    if (result.modifiedCount !== 1) throw new Error("UPLOAD_NOT_AVAILABLE");
  }
}
