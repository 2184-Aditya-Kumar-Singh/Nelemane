import mongoose, { Types } from "mongoose";

import { pgAdminUpdateSchema, pgDeletionSchema } from "@/lib/pg-schemas";
import { serializePgAdminDetail } from "@/server/admin/serializers";
import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { writeAuditLog } from "@/server/auth/audit";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { UserModel } from "@/server/db/models/user";
import { getEmailProvider } from "@/server/providers/email";
import { getSmsProvider } from "@/server/providers/sms";
import { escapeHtml } from "@/server/admin/serializers";

export const runtime = "nodejs";

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ pgId: string }> },
) {
  try {
    await requireRoles("SUPER_ADMIN");
    const { pgId } = await context.params;
    if (!Types.ObjectId.isValid(pgId)) return Response.json({ error: { message: "PG was not found" } }, { status: 404 });
    await connectToDatabase();
    const pg = await PgModel.findById(pgId).lean();
    if (!pg) return Response.json({ error: { message: "PG was not found" } }, { status: 404 });
    return Response.json({ pg: serializePgAdminDetail(pg as never) });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "PG details could not be loaded" } }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ pgId: string }> },
) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const admin = await requireRoles("SUPER_ADMIN");
    const { pgId } = await context.params;
    if (!Types.ObjectId.isValid(pgId)) return Response.json({ error: { message: "PG was not found" } }, { status: 404 });
    const parsed = pgAdminUpdateSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) {
      return Response.json({
        error: {
          message: "Review the highlighted fields",
          fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      }, { status: 400 });
    }

    await connectToDatabase();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).session(session);
        if (!pg) throw new Error("PG_NOT_AVAILABLE");
        await UserModel.updateOne(
          { _id: pg.ownerUserId, status: { $ne: "DELETED" } },
          { $set: { name: parsed.data.owner.name, email: parsed.data.owner.email, phone: parsed.data.owner.phone } },
          { session, runValidators: true },
        );
        pg.name = parsed.data.name;
        pg.owner = { ...parsed.data.owner };
        pg.address = {
          ...parsed.data.address,
          landmark: parsed.data.address.landmark,
          mapsUrl: parsed.data.address.mapsUrl || undefined,
        };
        pg.gstNumber = parsed.data.gstNumber || undefined;
        pg.nominee = {
          name: parsed.data.nominee.name,
          phone: parsed.data.nominee.phone || undefined,
          relation: parsed.data.nominee.relation,
        };
        pg.subscription.planLabel = parsed.data.subscription.planLabel;
        pg.subscription.startsAt = parsed.data.subscription.startsAt;
        pg.subscription.endsAt = parsed.data.subscription.endsAt;
        pg.subscription.notes = parsed.data.subscription.notes;
        await pg.save({ session });
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(admin.id),
          action: "PG_UPDATED",
          entity: "PG",
          entityId: new Types.ObjectId(pgId),
          meta: { name: parsed.data.name, ownerEmail: parsed.data.owner.email, subscriptionPlan: parsed.data.subscription.planLabel },
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    return Response.json({ saved: true });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (error instanceof Error && error.message === "PG_NOT_AVAILABLE") return Response.json({ error: { message: "This PG cannot be edited" } }, { status: 404 });
    if (isDuplicateKeyError(error)) return Response.json({ error: { message: "An account with this owner email already exists" } }, { status: 409 });
    return Response.json({ error: { message: "PG changes could not be saved" } }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ pgId: string }> },
) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const admin = await requireRoles("SUPER_ADMIN");
    const { pgId } = await context.params;
    if (!Types.ObjectId.isValid(pgId)) return Response.json({ error: { message: "PG was not found" } }, { status: 404 });
    const parsed = pgDeletionSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) {
      return Response.json({
        error: {
          message: "Enter the exact PG name and a reason",
          fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      }, { status: 400 });
    }

    await connectToDatabase();
    let pgOwner: { name: string; email: string; phone: string } | null = null;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).session(session);
        if (!pg) throw new Error("PG_NOT_AVAILABLE");
        if (pg.name.trim().toLocaleLowerCase("en-IN") !== parsed.data.confirmName.trim().toLocaleLowerCase("en-IN")) {
          throw new Error("PG_NAME_MISMATCH");
        }
        pgOwner = { name: pg.owner.name, email: pg.owner.email, phone: pg.owner.phone };
        pg.status = "DELETED";
        pg.deletedAt = new Date();
        pg.isListed = false;
        pg.subscription.status = "CANCELLED";
        await pg.save({ session });
        await UserModel.updateMany(
          { pgId: new Types.ObjectId(pgId), status: { $ne: "DELETED" } },
          { $set: { status: "DISABLED" } },
          { session },
        );
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(admin.id),
          action: "PG_SOFT_DELETED",
          entity: "PG",
          entityId: new Types.ObjectId(pgId),
          meta: { name: pg.name, reason: parsed.data.reason },
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    const owner = pgOwner as { name: string; email: string; phone: string } | null;
    if (!owner) return Response.json({ error: { message: "PG could not be deleted" } }, { status: 500 });
    const pgName = parsed.data.confirmName;
    const reason = parsed.data.reason;
    const dedupe = `pg-deleted-${pgId}`;
    const message = `Hello ${owner.name}, your Nelemane PG ${pgName} has been removed. Reason: ${reason}. Contact support if you believe this was a mistake.`;
    const notifyEmail = async () => {
      try {
        const result = await getEmailProvider().send({
          to: owner.email,
          template: "pg-deleted",
          dedupeKey: `${dedupe}-email`,
          subject: `Nelemane PG removed: ${pgName}`,
          text: message,
          html: `<p>${escapeHtml(message)}</p>`,
        });
        return result.status;
      } catch {
        return "FAILED" as const;
      }
    };
    const notifySms = async () => {
      try {
        const result = await getSmsProvider().send({
          to: owner.phone,
          template: "pg-deleted",
          dedupeKey: `${dedupe}-sms`,
          text: `PG ${pgName} removed. Reason: ${reason}. Contact Nelemane support if mistaken.`,
        });
        return result.status;
      } catch {
        return "FAILED" as const;
      }
    };
    const [email, sms] = await Promise.all([notifyEmail(), notifySms()]);
    await writeAuditLog({
      actorId: admin.id,
      action: "PG_DELETION_NOTIFICATIONS_SENT",
      entity: "PG",
      entityId: pgId,
      meta: { email, sms },
    }).catch(() => undefined);

    return Response.json({ deleted: true, notifications: { email, sms } });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (error instanceof Error && error.message === "PG_NAME_MISMATCH") return Response.json({ error: { message: "The typed PG name does not match" } }, { status: 400 });
    if (error instanceof Error && error.message === "PG_NOT_AVAILABLE") return Response.json({ error: { message: "This PG is already deleted or unavailable" } }, { status: 404 });
    return Response.json({ error: { message: "PG deletion could not be completed" } }, { status: 500 });
  }
}
