import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export const USER_ROLES = ["SUPER_ADMIN", "PG_OWNER", "TENANT"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "DISABLED", "DELETED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserRecord {
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  mustChangePassword: boolean;
  profilePhoto?: {
    url: string;
    publicId: string;
  };
  pgId?: Types.ObjectId;
  status: UserStatus;
  lastLoginAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const profilePhotoSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const userSchema = new Schema<UserRecord>(
  {
    role: { type: String, enum: USER_ROLES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    phone: { type: String, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    mustChangePassword: { type: Boolean, required: true, default: true },
    profilePhoto: { type: profilePhotoSchema, default: undefined },
    pgId: {
      type: Schema.Types.ObjectId,
      ref: "PG",
      default: undefined,
      required: function (this: { role: UserRole }) {
        return this.role !== "SUPER_ADMIN";
      },
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      required: true,
      default: "ACTIVE",
    },
    lastLoginAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true, name: "user_email_unique" });
userSchema.index({ role: 1, status: 1 }, { name: "user_role_status" });
userSchema.index(
  { pgId: 1, role: 1, status: 1 },
  { name: "user_pg_role_status" },
);

export const UserModel =
  (models.User as Model<UserRecord> | undefined) ??
  model<UserRecord>("User", userSchema);
