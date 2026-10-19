import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export const PG_STATUSES = ["ACTIVE", "DELETED"] as const;
export type PgStatus = (typeof PG_STATUSES)[number];
export const SUBSCRIPTION_STATUSES = ["ACTIVE", "SUSPENDED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const PG_GENDERS = ["BOYS", "GIRLS", "COED"] as const;
export type PgGender = (typeof PG_GENDERS)[number];
export const PG_ACCOUNT_TYPES = ["BUSINESS", "PERSONAL"] as const;
export type PgAccountType = (typeof PG_ACCOUNT_TYPES)[number];

export interface PgAsset {
  url: string;
  publicId: string;
}

export interface PgQrAccount {
  accountHolderName: string;
  upiId: string;
  qrImage: PgAsset;
}

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
  algorithm: "AES-256-GCM";
}

export interface PgRecord {
  name: string;
  slug: string;
  ownerUserId: Types.ObjectId;
  owner: { name: string; phone: string; email: string };
  nominee: { name: string; phone?: string; relation?: string };
  address: {
    line1: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    lat?: number;
    lng?: number;
    mapsUrl?: string;
  };
  gstNumber?: string;
  profilePhoto?: PgAsset;
  description: string;
  gender: PgGender;
  facilities: string[];
  customFacilities: string[];
  houseRules: string;
  photos: Array<PgAsset & { caption?: string }>;
  paymentDetails: {
    accountType: PgAccountType;
    upiId?: string;
    qrImage?: PgAsset;
    qrAccounts?: PgQrAccount[];
    bank?: {
      accountHolderName: string;
      bankName: string;
      accountNumber: EncryptedValue;
      ifsc: string;
      branch?: string;
    };
    instructions?: string;
  };
  rentWindow: { startDay: number; endDay: number };
  reminder: {
    enabled: boolean;
    everyNDays: number;
    email: boolean;
    sms: boolean;
  };
  subscription: {
    status: SubscriptionStatus;
    planLabel: string;
    startsAt: Date;
    endsAt: Date;
    notes?: string;
  };
  isListed: boolean;
  ratingAvg: number;
  ratingCount: number;
  status: PgStatus;
  deletedAt?: Date;
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

const encryptedValueSchema = new Schema<EncryptedValue>(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    algorithm: { type: String, enum: ["AES-256-GCM"], required: true },
  },
  { _id: false },
);

const qrAccountSchema = new Schema<PgQrAccount>(
  {
    accountHolderName: { type: String, required: true, trim: true, maxlength: 120 },
    upiId: { type: String, required: true, trim: true, maxlength: 100 },
    qrImage: { type: assetSchema, required: true },
  },
  { _id: false },
);

const pgSchema = new Schema<PgRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    owner: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      phone: { type: String, required: true, trim: true, maxlength: 20 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    },
    nominee: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      phone: { type: String, trim: true, maxlength: 20 },
      relation: { type: String, trim: true, maxlength: 80 },
    },
    address: {
      line1: { type: String, required: true, trim: true, maxlength: 160 },
      locality: { type: String, required: true, trim: true, maxlength: 120 },
      city: { type: String, required: true, trim: true, default: "Bengaluru" },
      state: { type: String, required: true, trim: true, default: "Karnataka" },
      pincode: { type: String, required: true, trim: true, maxlength: 6 },
      landmark: { type: String, trim: true, maxlength: 160 },
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
      mapsUrl: { type: String, trim: true, maxlength: 500 },
    },
    gstNumber: { type: String, trim: true, uppercase: true, maxlength: 15 },
    profilePhoto: { type: assetSchema, default: undefined },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    gender: { type: String, enum: PG_GENDERS, required: true, default: "COED" },
    facilities: { type: [String], default: [] },
    customFacilities: { type: [String], default: [] },
    houseRules: { type: String, trim: true, maxlength: 4000, default: "" },
    photos: { type: [new Schema({ ...assetSchema.obj, caption: { type: String, trim: true, maxlength: 240 } }, { _id: false })], default: [] },
    paymentDetails: {
      accountType: { type: String, enum: PG_ACCOUNT_TYPES, required: true },
      upiId: { type: String, trim: true, maxlength: 100 },
      qrImage: { type: assetSchema, default: undefined },
      qrAccounts: { type: [qrAccountSchema], default: [] },
      bank: {
        accountHolderName: { type: String, trim: true, maxlength: 120 },
        bankName: { type: String, trim: true, maxlength: 120 },
        accountNumber: { type: encryptedValueSchema },
        ifsc: { type: String, trim: true, uppercase: true, maxlength: 11 },
        branch: { type: String, trim: true, maxlength: 120 },
      },
      instructions: { type: String, trim: true, maxlength: 1000 },
    },
    rentWindow: {
      startDay: { type: Number, required: true, min: 1, max: 28, default: 1 },
      endDay: { type: Number, required: true, min: 1, max: 28, default: 5 },
    },
    reminder: {
      enabled: { type: Boolean, default: true },
      everyNDays: { type: Number, min: 1, max: 30, default: 2 },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    subscription: {
      status: { type: String, enum: SUBSCRIPTION_STATUSES, required: true, default: "ACTIVE" },
      planLabel: { type: String, required: true, trim: true, maxlength: 80 },
      startsAt: { type: Date, required: true },
      endsAt: { type: Date, required: true },
      notes: { type: String, trim: true, maxlength: 1000 },
    },
    isListed: { type: Boolean, required: true, default: false },
    ratingAvg: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: PG_STATUSES, required: true, default: "ACTIVE" },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

pgSchema.index({ slug: 1 }, { unique: true, name: "pg_slug_unique" });
pgSchema.index({ status: 1, createdAt: -1 }, { name: "pg_status_created" });
pgSchema.index({ "subscription.status": 1, "subscription.endsAt": 1 }, { name: "pg_subscription_expiry" });
pgSchema.index({ "address.locality": 1, isListed: 1, status: 1 }, { name: "pg_public_locality" });
pgSchema.index({ status: 1, "subscription.status": 1, isListed: 1, ratingAvg: -1, createdAt: -1 }, { name: "pg_public_discovery" });
pgSchema.index({ deletedAt: 1 }, { name: "pg_deleted_at" });

export const PgModel =
  (models.PG as Model<PgRecord> | undefined) ?? model<PgRecord>("PG", pgSchema);
