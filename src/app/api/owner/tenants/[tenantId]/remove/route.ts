import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";

import { tenantRemovalSchema } from "@/lib/tenant-schemas";
import { escapeHtml } from "@/server/admin/serializers";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { RoomModel } from "@/server/db/models/room";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { TenantModel } from "@/server/db/models/tenant";
import { UserModel } from "@/server/db/models/user";
import { getEmailProvider } from "@/server/providers/email";
import { getSmsProvider } from "@/server/providers/sms";
import { getStorageProvider } from "@/server/providers/storage";

export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { tenantId } = await context.params;
    if (!Types.ObjectId.isValid(tenantId)) return Response.json({ error: { message: "Tenant was not found" } }, { status: 404 });
    const parsed = tenantRemovalSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Confirm the tenant name and review the selected actions" } }, { status: 400 });
    await connectToDatabase();
    const session = await mongoose.startSession();
    let tenantName = "";
    let tenantEmail = "";
    let tenantPhone = "";
    let pgName = "";
    let removedAadhaarId = "";
    let notificationEvent = "";
    try {
      await session.withTransaction(async () => {
        const tenant = await TenantModel.findOne({ _id: tenantId, pgId, status: "ACTIVE" }).session(session);
        if (!tenant) throw new Error("TENANT_NOT_ACTIVE");
        if (tenant.name !== parsed.data.confirmName) throw new Error("TENANT_NAME_MISMATCH");
        const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name").session(session).lean();
        if (!pg) throw new Error("PG_NOT_AVAILABLE");
        const roomUpdate = await RoomModel.updateOne(
          { _id: tenant.roomId, pgId, $expr: { $gt: [{ $ifNull: ["$occupiedCount", 0] }, 0] } },
          { $inc: { occupiedCount: -1 } },
          { session },
        );
        if (roomUpdate.modifiedCount !== 1) throw new Error("ROOM_OCCUPANCY_NOT_AVAILABLE");

        tenantName = tenant.name;
        tenantEmail = tenant.email;
        tenantPhone = tenant.phone;
        pgName = pg.name;
        if (parsed.data.deleteAadhaarNow && tenant.aadhaarCard) {
          removedAadhaarId = tenant.aadhaarCard.publicId;
          tenant.aadhaarCard = undefined;
          tenant.aadhaarConsentAt = undefined;
        }
        tenant.status = "VACATED";
        tenant.vacatedAt = new Date();
        await tenant.save({ session });
        const disabled = await UserModel.updateOne({ _id: tenant.userId, pgId, role: "TENANT", status: "ACTIVE" }, { $set: { status: "DISABLED" } }, { session });
        if (disabled.modifiedCount !== 1) throw new Error("TENANT_ACCOUNT_NOT_ACTIVE");
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(user.id), action: "TENANT_VACATED", entity: "Tenant", entityId: tenant._id,
          meta: { pgId, roomId: tenant.roomId.toString(), aadhaarDeleted: Boolean(removedAadhaarId) },
        }], { session });
        notificationEvent = randomUUID();
      });
    } finally {
      await session.endSession();
    }

    let imageCleanup: "COMPLETE" | "PENDING" = "COMPLETE";
    if (removedAadhaarId) {
      try {
        await getStorageProvider().delete(removedAadhaarId);
        await TemporaryAssetModel.deleteOne({ pgId, publicId: removedAadhaarId });
      } catch { imageCleanup = "PENDING"; }
    }

    const text = `Your residency at ${pgName} has been marked as vacated by your PG owner. Contact the PG owner if you believe this is incorrect.`;
    const [emailResult, smsResult] = await Promise.allSettled([
      (async () => getEmailProvider().send({
        to: tenantEmail, template: "tenant-vacated", dedupeKey: `tenant-vacated-${tenantId}-${notificationEvent}`,
        subject: `Your residency at ${pgName} has ended`, text,
        html: `<p>Hello ${escapeHtml(tenantName)},</p><p>${escapeHtml(text)}</p>`,
      }))(),
      (async () => getSmsProvider().send({ to: tenantPhone, template: "tenant-vacated", dedupeKey: `tenant-vacated-sms-${tenantId}-${notificationEvent}`, text }))(),
    ]);
    const notifications = {
      email: emailResult.status === "fulfilled" ? emailResult.value.status : "FAILED",
      sms: smsResult.status === "fulfilled" ? smsResult.value.status : "FAILED",
    };
    if (notifications.email === "FAILED" || notifications.sms === "FAILED") {
      await AuditLogModel.create({ actorId: new Types.ObjectId(user.id), action: "TENANT_VACATED_NOTIFICATION_FAILED", entity: "Tenant", entityId: tenantId, meta: { pgId, ...notifications } }).catch(() => undefined);
    }
    return Response.json({ vacated: true, notifications, imageCleanup });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "TENANT_NAME_MISMATCH") return Response.json({ error: { message: "The typed name does not match this tenant" } }, { status: 400 });
    if (error instanceof Error && error.message === "TENANT_NOT_ACTIVE") return Response.json({ error: { message: "This tenant is already vacated or unavailable" } }, { status: 404 });
    if (error instanceof Error && error.message === "TENANT_ACCOUNT_NOT_ACTIVE") return Response.json({ error: { message: "The tenant account could not be disabled" } }, { status: 409 });
    if (error instanceof Error && error.message === "ROOM_OCCUPANCY_NOT_AVAILABLE") return Response.json({ error: { message: "The room occupancy could not be updated; ask an administrator for help" } }, { status: 409 });
    if (error instanceof Error && error.message === "PG_NOT_AVAILABLE") return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    return Response.json({ error: { message: "Tenant could not be removed" } }, { status: 500 });
  }
}
