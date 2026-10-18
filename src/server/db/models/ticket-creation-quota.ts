import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export interface TicketCreationQuotaRecord {
  tenantId: Types.ObjectId;
  dayKey: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const quotaSchema = new Schema<TicketCreationQuotaRecord>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  count: { type: Number, required: true, min: 1, max: 5 },
}, { timestamps: true });
quotaSchema.index({ tenantId: 1, dayKey: 1 }, { unique: true, name: "ticket_quota_tenant_day_unique" });
quotaSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 24 * 60 * 60, name: "ticket_quota_ttl" });

export const TicketCreationQuotaModel = (models.TicketCreationQuota as Model<TicketCreationQuotaRecord> | undefined) ?? model<TicketCreationQuotaRecord>("TicketCreationQuota", quotaSchema);
