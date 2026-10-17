import { model, models, Schema, type Model, type Types } from "mongoose";

export interface PaymentSubmissionQuotaRecord {
  tenantId: Types.ObjectId;
  dayKey: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const quotaSchema = new Schema<PaymentSubmissionQuotaRecord>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  count: { type: Number, required: true, min: 1, max: 10 },
}, { timestamps: true });

quotaSchema.index({ tenantId: 1, dayKey: 1 }, { unique: true, name: "payment_quota_tenant_day_unique" });
quotaSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 24 * 60 * 60, name: "payment_quota_ttl" });

export const PaymentSubmissionQuotaModel = (models.PaymentSubmissionQuota as Model<PaymentSubmissionQuotaRecord> | undefined) ?? model<PaymentSubmissionQuotaRecord>("PaymentSubmissionQuota", quotaSchema);
