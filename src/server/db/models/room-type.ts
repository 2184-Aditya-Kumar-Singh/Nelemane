import { model, models, Schema, type Model, type Types } from "mongoose";

import type { PgAsset } from "@/server/db/models/pg";

export interface RoomTypeRecord {
  pgId: Types.ObjectId;
  name: string;
  sharing: number;
  ac: boolean;
  attachedBath: boolean;
  rent: number;
  deposit: number;
  description: string;
  amenities: string[];
  photos: PgAsset[];
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<PgAsset>(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const roomTypeSchema = new Schema<RoomTypeRecord>(
  {
    pgId: { type: Schema.Types.ObjectId, ref: "PG", required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    sharing: { type: Number, required: true, min: 1, max: 6 },
    ac: { type: Boolean, required: true, default: false },
    attachedBath: { type: Boolean, required: true, default: false },
    rent: { type: Number, required: true, min: 0, max: 100_000_000 },
    deposit: { type: Number, required: true, min: 0, max: 1_000_000_000 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    amenities: { type: [String], default: [] },
    photos: { type: [assetSchema], default: [] },
  },
  { timestamps: true },
);

roomTypeSchema.index({ pgId: 1, createdAt: -1 }, { name: "room_type_pg_created" });
roomTypeSchema.index({ pgId: 1, name: 1 }, { name: "room_type_pg_name" });

export const RoomTypeModel =
  (models.RoomType as Model<RoomTypeRecord> | undefined) ??
  model<RoomTypeRecord>("RoomType", roomTypeSchema);
