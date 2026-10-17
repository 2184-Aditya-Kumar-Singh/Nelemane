import { model, models, Schema, type Model, type Types } from "mongoose";

export const UPLOAD_PURPOSES = [
  "OWNER_PROFILE",
  "PG_PROFILE",
  "PAYMENT_QR",
  "OWNER_PG_PROFILE",
  "PG_GALLERY",
  "ROOM_TYPE_PHOTO",
  "OWNER_PAYMENT_QR",
  "TENANT_PROFILE",
  "TENANT_AADHAAR",
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export interface TemporaryAssetRecord {
  ownerUserId: Types.ObjectId;
  purpose: UploadPurpose;
  publicId: string;
  url: string;
  resourceType: "image" | "raw";
  visibility: "public" | "private";
  expiresAt: Date;
  claimedAt?: Date;
  pgId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const temporaryAssetSchema = new Schema<TemporaryAssetRecord>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: UPLOAD_PURPOSES, required: true },
    publicId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    resourceType: { type: String, enum: ["image", "raw"], required: true },
    visibility: { type: String, enum: ["public", "private"], required: true },
    expiresAt: { type: Date, required: true },
    claimedAt: { type: Date },
    pgId: { type: Schema.Types.ObjectId, ref: "PG" },
  },
  { timestamps: true },
);

temporaryAssetSchema.index({ expiresAt: 1 }, { name: "temporary_asset_expiry" });
temporaryAssetSchema.index({ ownerUserId: 1, purpose: 1, claimedAt: 1 }, { name: "temporary_asset_owner_purpose" });

export const TemporaryAssetModel =
  (models.TemporaryAsset as Model<TemporaryAssetRecord> | undefined) ??
  model<TemporaryAssetRecord>("TemporaryAsset", temporaryAssetSchema);
