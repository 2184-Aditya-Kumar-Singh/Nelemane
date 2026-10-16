import { model, models, Schema, type Model } from "mongoose";

export type NotificationChannel = "EMAIL" | "SMS";
export type NotificationStatus = "SENT" | "FAILED" | "SKIPPED";

export interface NotificationLogRecord {
  to: string;
  channel: NotificationChannel;
  template: string;
  status: NotificationStatus;
  providerId?: string;
  error?: string;
  dedupeKey: string;
}

const notificationLogSchema = new Schema<NotificationLogRecord>(
  {
    to: { type: String, required: true, trim: true },
    channel: { type: String, enum: ["EMAIL", "SMS"], required: true },
    template: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["SENT", "FAILED", "SKIPPED"],
      required: true,
    },
    providerId: { type: String },
    error: { type: String },
    dedupeKey: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

notificationLogSchema.index({ dedupeKey: 1 }, { unique: true });

export const NotificationLogModel =
  (models.NotificationLog as Model<NotificationLogRecord> | undefined) ??
  model<NotificationLogRecord>("NotificationLog", notificationLogSchema);
