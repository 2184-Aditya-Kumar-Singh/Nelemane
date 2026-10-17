import { model, models, Schema, type Model, type Types } from "mongoose";

export const TICKET_CATEGORIES = ["ELECTRICAL", "PLUMBING", "WIFI", "CLEANING", "FOOD", "FURNITURE", "OTHER"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED_AWAITING_APPROVAL", "CLOSED", "REOPENED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface TicketImage {
  publicId: string;
  resourceType: "image" | "raw";
}
export interface TicketTimelineEntry {
  at: Date;
  by: Types.ObjectId;
  action: string;
  note?: string;
}
export interface TicketRecord {
  pgId: Types.ObjectId;
  tenantId: Types.ObjectId;
  roomId: Types.ObjectId;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  images: TicketImage[];
  status: TicketStatus;
  resolution?: { note: string; images: TicketImage[]; resolvedAt: Date };
  tenantFeedback?: { approved: boolean; comment?: string; at: Date };
  timeline: TicketTimelineEntry[];
  approvalTokenHash?: string;
  approvalTokenExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ticketImageSchema = new Schema<TicketImage>({
  publicId: { type: String, required: true, trim: true, maxlength: 500 },
  resourceType: { type: String, enum: ["image", "raw"], required: true },
}, { _id: false });
const timelineSchema = new Schema<TicketTimelineEntry>({
  at: { type: Date, required: true, default: Date.now },
  by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true, trim: true, maxlength: 80 },
  note: { type: String, trim: true, maxlength: 1000 },
}, { _id: false });

const ticketSchema = new Schema<TicketRecord>({
  pgId: { type: Schema.Types.ObjectId, ref: "PG", required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  category: { type: String, enum: TICKET_CATEGORIES, required: true },
  priority: { type: String, enum: TICKET_PRIORITIES, required: true, default: "NORMAL" },
  images: { type: [ticketImageSchema], default: [], validate: (items: TicketImage[]) => items.length <= 5 },
  status: { type: String, enum: TICKET_STATUSES, required: true, default: "OPEN" },
  resolution: {
    note: { type: String, trim: true, maxlength: 2000 },
    images: { type: [ticketImageSchema], default: [] },
    resolvedAt: { type: Date },
  },
  tenantFeedback: {
    approved: { type: Boolean },
    comment: { type: String, trim: true, maxlength: 1000 },
    at: { type: Date },
  },
  timeline: { type: [timelineSchema], default: [] },
  approvalTokenHash: { type: String, select: false },
  approvalTokenExpiresAt: { type: Date, select: false },
}, { timestamps: true });

ticketSchema.index({ pgId: 1, status: 1, createdAt: -1 }, { name: "ticket_pg_status_created" });
ticketSchema.index({ tenantId: 1, createdAt: -1 }, { name: "ticket_tenant_created" });
ticketSchema.index({ approvalTokenExpiresAt: 1 }, { name: "ticket_approval_expiry" });

export const TicketModel = (models.Ticket as Model<TicketRecord> | undefined) ?? model<TicketRecord>("Ticket", ticketSchema);
