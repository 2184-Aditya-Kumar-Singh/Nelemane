import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

import type { PgAsset } from "@/server/db/models/pg";

export const TENANT_STATUSES = ["ACTIVE", "VACATED"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export interface TenantRecord {
  pgId: Types.ObjectId;
  userId: Types.ObjectId;
  roomId: Types.ObjectId;
  name: string;
  phone: string;
  email: string;
  parents: { fatherName: string; motherName?: string; phone: string; alternatePhone?: string };
  monthlyRent: number;
  deposit: number;
  joinedAt: Date;
  profilePhoto?: PgAsset;
  aadhaarCard?: PgAsset;
  aadhaarConsentAt?: Date;
  status: TenantStatus;
  vacatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<PgAsset>({
  url: { type: String, required: true, trim: true },
  publicId: { type: String, required: true, trim: true },
}, { _id: false });

const tenantSchema = new Schema<TenantRecord>({
  pgId: { type: Schema.Types.ObjectId, ref: "PG", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  parents: {
    fatherName: { type: String, required: true, trim: true, maxlength: 120 },
    motherName: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    alternatePhone: { type: String, trim: true, maxlength: 20 },
  },
  monthlyRent: { type: Number, required: true, min: 0, max: 100_000_000 },
  deposit: { type: Number, required: true, min: 0, max: 1_000_000_000 },
  joinedAt: { type: Date, required: true },
  profilePhoto: { type: assetSchema, default: undefined },
  aadhaarCard: { type: assetSchema, default: undefined },
  aadhaarConsentAt: { type: Date },
  status: { type: String, enum: TENANT_STATUSES, required: true, default: "ACTIVE" },
  vacatedAt: { type: Date },
}, { timestamps: true });

tenantSchema.index({ userId: 1 }, { unique: true, name: "tenant_user_unique" });
tenantSchema.index({ pgId: 1, status: 1, name: 1 }, { name: "tenant_pg_status_name" });
tenantSchema.index({ pgId: 1, roomId: 1, status: 1 }, { name: "tenant_room_occupancy" });
tenantSchema.index({ pgId: 1, joinedAt: -1 }, { name: "tenant_pg_joined" });

export const TenantModel = (models.Tenant as Model<TenantRecord> | undefined) ?? model<TenantRecord>("Tenant", tenantSchema);
