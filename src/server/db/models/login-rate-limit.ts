import mongoose, { type Model } from "mongoose";

const { model, models, Schema } = mongoose;

export interface LoginRateLimitRecord {
  key: string;
  count: number;
  windowStartedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const loginRateLimitSchema = new Schema<LoginRateLimitRecord>(
  {
    key: { type: String, required: true },
    count: { type: Number, required: true, min: 1 },
    windowStartedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

loginRateLimitSchema.index({ key: 1 }, { unique: true, name: "login_limit_key" });
loginRateLimitSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "login_limit_expiry" },
);

export const LoginRateLimitModel =
  (models.LoginRateLimit as Model<LoginRateLimitRecord> | undefined) ??
  model<LoginRateLimitRecord>("LoginRateLimit", loginRateLimitSchema);
