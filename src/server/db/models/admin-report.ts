import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export const ADMIN_REPORT_STATUSES = ["OPEN", "RESOLVED"] as const;
export type AdminReportStatus = (typeof ADMIN_REPORT_STATUSES)[number];

export interface AdminReportRecord {
  fromUserId: Types.ObjectId;
  pgId: Types.ObjectId;
  tenantId?: Types.ObjectId;
  subject: string;
  message: string;
  status: AdminReportStatus;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminReportSchema = new Schema<AdminReportRecord>(
  {
    fromUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pgId: { type: Schema.Types.ObjectId, ref: "PG", required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant" },
    subject: { type: String, required: true, trim: true, maxlength: 180 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: { type: String, enum: ADMIN_REPORT_STATUSES, required: true, default: "OPEN" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolutionNote: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

adminReportSchema.index({ status:  1, createdAt: -1 }, { name: "admin_report_status_date" });
adminReportSchema.index({ pgId: 1, createdAt: -1 }, { name: "admin_report_pg_date" });

export const AdminReportModel =
  (models.AdminReport as Model<AdminReportRecord> | undefined) ??
  model<AdminReportRecord>("AdminReport", adminReportSchema);
