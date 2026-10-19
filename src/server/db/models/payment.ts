import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export const PAYMENT_SOURCES = ["TENANT", "OWNER"] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];
export const PAYMENT_MODES = ["UPI", "BANK_TRANSFER", "CASH", "OTHER"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export const PAYMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface PaymentRecord {
  pgId: Types.ObjectId;
  tenantId: Types.ObjectId;
  chargeId: Types.ObjectId;
  month: string;
  source: PaymentSource;
  mode: PaymentMode;
  transactionId?: string;
  transactionDate: Date;
  amountSubmitted: number;
  payerName: string;
  recipientAccountName?: string;
  /** Legacy tenant source-account field; do not use as the payment recipient name. */
  senderAccountName?: string;
  note?: string;
  screenshot?: { publicId: string; resourceType: "image" | "raw" };
  status: PaymentStatus;
  approvedAmount?: number;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const screenshotSchema = new Schema({
  publicId: { type: String, required: true, trim: true },
  resourceType: { type: String, enum: ["image", "raw"], required: true },
}, { _id: false });

const paymentSchema = new Schema<PaymentRecord>({
  pgId: { type: Schema.Types.ObjectId, ref: "PG", required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  chargeId: { type: Schema.Types.ObjectId, ref: "RentCharge", required: true },
  month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  source: { type: String, enum: PAYMENT_SOURCES, required: true },
  mode: { type: String, enum: PAYMENT_MODES, required: true },
  transactionId: { type: String, trim: true, uppercase: true, maxlength: 35 },
  transactionDate: { type: Date, required: true },
  amountSubmitted: { type: Number, required: true, min: 1 },
  payerName: { type: String, required: true, trim: true, maxlength: 120 },
  recipientAccountName: { type: String, trim: true, maxlength: 120 },
  // Retained only so existing documents with this legacy field remain readable.
  senderAccountName: { type: String, trim: true, maxlength: 120 },
  note: { type: String, trim: true, maxlength: 1000 },
  screenshot: { type: screenshotSchema, default: undefined },
  status: { type: String, enum: PAYMENT_STATUSES, required: true, default: "PENDING" },
  approvedAmount: { type: Number, min: 1 },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewedAt: { type: Date },
  rejectionReason: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

paymentSchema.index({ pgId: 1, transactionId: 1 }, {
  unique: true,
  name: "payment_pg_transaction_active_unique",
  partialFilterExpression: { $or: [{ status: "PENDING" }, { status: "APPROVED" }], transactionId: { $type: "string" } },
});
paymentSchema.index({ pgId: 1, status: 1, createdAt: 1 }, { name: "payment_verification_queue" });
paymentSchema.index({ tenantId: 1, createdAt: -1 }, { name: "payment_tenant_history" });
paymentSchema.index({ chargeId: 1, status: 1 }, { name: "payment_charge_status" });

export const PaymentModel = (models.Payment as Model<PaymentRecord> | undefined) ?? model<PaymentRecord>("Payment", paymentSchema);
