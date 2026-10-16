import { model, models, Schema, type Model, type Types } from "mongoose";

export interface AuditLogRecord {
  actorId?: Types.ObjectId;
  action: string;
  entity: string;
  entityId?: Types.ObjectId;
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<AuditLogRecord>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    entity: { type: String, required: true, trim: true, maxlength: 100 },
    entityId: { type: Schema.Types.ObjectId },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String, trim: true, maxlength: 64 },
  },
  { timestamps: true },
);

auditLogSchema.index({ actorId: 1, createdAt: -1 }, { name: "audit_actor_date" });
auditLogSchema.index(
  { entity: 1, entityId: 1, createdAt: -1 },
  { name: "audit_entity_date" },
);
auditLogSchema.index({ action: 1, createdAt: -1 }, { name: "audit_action_date" });

export const AuditLogModel =
  (models.AuditLog as Model<AuditLogRecord> | undefined) ??
  model<AuditLogRecord>("AuditLog", auditLogSchema);
