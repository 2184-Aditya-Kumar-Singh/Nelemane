import { Types } from "mongoose";

import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";

function parseDate(value: string | null): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export async function GET(request: Request) {
  try {
    await requireRoles("SUPER_ADMIN");
    await connectToDatabase();
    const params = new URL(request.url).searchParams;
    const filter: Record<string, unknown> = {};
    const action = params.get("action")?.trim().slice(0, 100);
    const entity = params.get("entity")?.trim().slice(0, 100);
    const actorId = params.get("actorId");
    const from = parseDate(params.get("from"));
    const to = parseDate(params.get("to"));
    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (actorId && Types.ObjectId.isValid(actorId)) filter.actorId = actorId;
    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) createdAt.$gte = from;
      if (to) {
        const end = new Date(to);
        end.setUTCDate(end.getUTCDate() + 1);
        createdAt.$lt = end;
      }
      filter.createdAt = createdAt;
    }
    const logs = await AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("actorId", "name email")
      .lean();
    return Response.json({ logs: logs.map((log) => ({
      id: log._id.toString(),
      action: log.action,
      entity: log.entity,
      entityId: log.entityId?.toString() ?? null,
      meta: log.meta ?? {},
      ip: log.ip ?? null,
      actor: (() => {
        const populatedActor = log.actorId as unknown as { name?: unknown; email?: unknown } | null;
        return populatedActor && typeof populatedActor.name === "string"
          ? { name: populatedActor.name, email: String(populatedActor.email ?? "") }
          : null;
      })(),
      createdAt: log.createdAt.toISOString(),
    })) });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "Audit logs could not be loaded" } }, { status: 500 });
  }
}
