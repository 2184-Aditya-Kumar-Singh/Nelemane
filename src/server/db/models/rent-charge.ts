import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export const RENT_CHARGE_STATUSES = ["UNPAID", "PENDING_VERIFICATION", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;
export type RentChargeStatus = (typeof RENT_CHARGE_STATUSES)[number];

export interface RentChargeRecord {
  pgId: Types.ObjectId;
  tenantId: Types.ObjectId;
  month: string;
  amount: number;
  paidAmount: number;
  windowStart: Date;
  windowEnd: Date;
  status: RentChargeStatus;
  lastReminderAt?: Date;
  lastOverdueReminderAt?: Date;
  reminderCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const rentChargeSchema = new Schema<RentChargeRecord>({
  pgId: { type: Schema.Types.ObjectId, ref: "PG", required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  amount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, required: true, min: 0, default: 0 },
  windowStart: { type: Date, required: true },
  windowEnd: { type: Date, required: true },
  status: { type: String, enum: RENT_CHARGE_STATUSES, required: true, default: "UNPAID" },
  lastReminderAt: { type: Date },
  lastOverdueReminderAt: { type: Date },
  reminderCount: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });

rentChargeSchema.index({ tenantId: 1, month: 1 }, { unique: true, name: "rent_charge_tenant_month_unique" });
rentChargeSchema.index({ pgId: 1, month: 1, status: 1 }, { name: "rent_charge_pg_month_status" });
rentChargeSchema.index({ pgId: 1, status: 1, windowEnd: 1 }, { name: "rent_charge_pg_due" });

export const RentChargeModel = (models.RentCharge as Model<RentChargeRecord> | undefined) ?? model<RentChargeRecord>("RentCharge", rentChargeSchema);
