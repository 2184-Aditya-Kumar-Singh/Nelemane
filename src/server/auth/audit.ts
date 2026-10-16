import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";

interface WriteAuditLogInput {
  actorId?: string | Types.ObjectId;
  action: string;
  entity: string;
  entityId?: string | Types.ObjectId;
  meta?: Record<string, unknown>;
  ip?: string;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  await connectToDatabase();

  await AuditLogModel.create({
    ...input,
    actorId: input.actorId ? new Types.ObjectId(input.actorId) : undefined,
    entityId: input.entityId ? new Types.ObjectId(input.entityId) : undefined,
  });
}
