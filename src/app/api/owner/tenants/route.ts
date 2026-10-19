import { randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";

import { tenantInputSchema } from "@/lib/tenant-schemas";
import { escapeHtml } from "@/server/admin/serializers";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { hashPassword } from "@/server/auth/password";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { RoomModel } from "@/server/db/models/room";
import { TenantModel } from "@/server/db/models/tenant";
import { UserModel } from "@/server/db/models/user";
import { getEmailProvider } from "@/server/providers/email";
import { getEnv } from "@/lib/env";
import { getSmsProvider } from "@/server/providers/sms";
import { getStorageProvider } from "@/server/providers/storage";
import { claimOwnerUploads, resolveOwnerPhotoReference } from "@/server/owner/asset-references";
import type { PgAsset } from "@/server/db/models/pg";

export const runtime = "nodejs";

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function GET() {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    await connectToDatabase();
    const tenants = await TenantModel.find({ pgId }).sort({ status: 1, name: 1 }).limit(500).populate({ path: "roomId", select: "roomNumber floor block roomTypeId", populate: { path: "roomTypeId", select: "name sharing" } }).lean();
    const results = await Promise.all(tenants.map(async (tenant) => {
      const room = tenant.roomId as unknown as { _id?: Types.ObjectId; roomNumber?: string; floor?: string; block?: string; roomTypeId?: Types.ObjectId | { _id?: Types.ObjectId; name?: string; sharing?: number } } | null;
      const populatedType = room?.roomTypeId && typeof room.roomTypeId === "object" && "name" in room.roomTypeId ? room.roomTypeId : null;
      const roomType = populatedType?.name ? { name: populatedType.name, sharing: populatedType.sharing ?? 1 } : null;
      const photoUrl = tenant.profilePhoto ? `/api/owner/tenants/${tenant._id.toString()}/photo` : "";
      return {
        id: tenant._id.toString(), userId: tenant.userId.toString(), name: tenant.name,
        email: tenant.email, phone: tenant.phone, status: tenant.status,
        room: room ? { id: room._id?.toString() ?? "", roomNumber: room.roomNumber ?? "", floor: room.floor ?? "", block: room.block ?? "", roomType } : null,
        monthlyRentPaise: tenant.monthlyRent, depositPaise: tenant.deposit,
        joinedAt: tenant.joinedAt.toISOString(), vacatedAt: tenant.vacatedAt?.toISOString() ?? null,
        profilePhotoUrl: photoUrl, hasAadhaar: Boolean(tenant.aadhaarCard),
      };
    }));
    return Response.json({ tenants: results });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Tenants could not be loaded" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  let credential = "";
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const parsed = tenantInputSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Review the tenant details", fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } }, { status: 400 });
    const env = parsed.data.sendCredentialsNow ? getEnv() : null;
    await connectToDatabase();
    if (await UserModel.exists({ email: parsed.data.email })) return Response.json({ error: { message: "An account with this email already exists" } }, { status: 409 });

    const session = await mongoose.startSession();
    let tenantId = "";
    let pgName = "";
    let delivery: "SENT" | "SKIPPED" | "FAILED" | "NOT_REQUESTED" = "NOT_REQUESTED";
    let smsDelivery: "SENT" | "SKIPPED" | "FAILED" | "NOT_REQUESTED" = "NOT_REQUESTED";
    try {
      await session.withTransaction(async () => {
        const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name").session(session).lean();
        if (!pg) throw new Error("PG_NOT_AVAILABLE");
        pgName = pg.name;
        const room = await RoomModel.findOneAndUpdate(
          { _id: parsed.data.roomId, pgId, $expr: { $lt: [{ $ifNull: ["$occupiedCount", 0] }, "$capacity"] } },
          { $inc: { occupiedCount: 1 } },
          { returnDocument: "after", session },
        ).lean();
        if (!room) {
          const exists = await RoomModel.exists({ _id: parsed.data.roomId, pgId }).session(session);
          throw new Error(exists ? "ROOM_FULL" : "ROOM_NOT_AVAILABLE");
        }

        const uploadIds = new Set<string>();
        let profilePhoto: PgAsset | undefined;
        let aadhaarCard: PgAsset | undefined;
        if (parsed.data.profilePhoto) {
          const photo = await resolveOwnerPhotoReference({ photo: parsed.data.profilePhoto, purpose: "TENANT_PROFILE", existing: [], ownerId: user.id, pgId, visibility: "private", session });
          profilePhoto = photo.asset;
          if (photo.uploadedAssetId) uploadIds.add(photo.uploadedAssetId);
        }
        if (parsed.data.aadhaarPhoto) {
          if (!parsed.data.aadhaarConsent) throw new Error("AADHAAR_CONSENT_REQUIRED");
          const photo = await resolveOwnerPhotoReference({ photo: parsed.data.aadhaarPhoto, purpose: "TENANT_AADHAAR", existing: [], ownerId: user.id, pgId, visibility: "private", session });
          aadhaarCard = photo.asset;
          if (photo.uploadedAssetId) uploadIds.add(photo.uploadedAssetId);
        }

        const userId = new Types.ObjectId();
        const tenantObjectId = new Types.ObjectId();
        tenantId = tenantObjectId.toString();
        credential = randomBytes(18).toString("base64url");
        await UserModel.create([{
          _id: userId, role: "TENANT", name: parsed.data.name, email: parsed.data.email,
          phone: parsed.data.phone, passwordHash: await hashPassword(credential), mustChangePassword: true,
          pgId: new Types.ObjectId(pgId), status: "ACTIVE",
        }], { session });
        await TenantModel.create([{
          _id: tenantObjectId, pgId: new Types.ObjectId(pgId), userId, roomId: room._id,
          name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email,
          parents: { fatherName: parsed.data.parents.fatherName, motherName: parsed.data.parents.motherName || undefined, phone: parsed.data.parents.phone, alternatePhone: parsed.data.parents.alternatePhone || undefined },
          monthlyRent: parsed.data.monthlyRentPaise, deposit: parsed.data.depositPaise,
          joinedAt: new Date(`${parsed.data.joinedAt}T00:00:00.000Z`), profilePhoto, aadhaarCard,
          aadhaarConsentAt: aadhaarCard ? new Date() : undefined, status: "ACTIVE",
        }], { session });
        await claimOwnerUploads({ ids: uploadIds, ownerId: user.id, pgId, session });
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(user.id), action: "TENANT_CREATED", entity: "Tenant", entityId: tenantObjectId,
          meta: { pgId, roomId: room._id.toString(), email: parsed.data.email, hasAadhaar: Boolean(aadhaarCard) },
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    if (parsed.data.sendCredentialsNow) {
      const loginUrl = `${env?.APP_URL}/login`;
      const safeName = escapeHtml(parsed.data.name);
      const safePg = escapeHtml(pgName);
      const emailPromise = (async () => getEmailProvider().send({
          to: parsed.data.email,
          template: "tenant-welcome",
          dedupeKey: `tenant-welcome-${tenantId}`,
          subject: `Your Nelemane account for ${pgName}`,
          text: `Hello ${parsed.data.name},\n\nYou have been added as a resident at ${pgName}.\nSign in: ${loginUrl}\nEmail: ${parsed.data.email}\nTemporary password: ${credential}\n\nYou will be asked to change your password after signing in.`,
          html: `<p>Hello ${safeName},</p><p>You have been added as a resident at <strong>${safePg}</strong>.</p><p><a href="${escapeHtml(loginUrl)}">Sign in</a><br>Email: ${escapeHtml(parsed.data.email)}<br>Temporary password: <strong>${escapeHtml(credential)}</strong></p><p>You will be asked to change your password after signing in.</p>`,
        }))();
      const smsPromise = env?.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID
        ? (async () => getSmsProvider().send({ to: parsed.data.phone, template: "tenant-welcome", dedupeKey: `tenant-welcome-sms-${tenantId}`, text: `Nelemane login ${loginUrl}; email ${parsed.data.email}; temporary password ${credential}. Change it after signing in.` }))()
        : Promise.resolve({ status: "SKIPPED" as const });
      const [emailResult, smsResult] = await Promise.allSettled([emailPromise, smsPromise]);
      delivery = emailResult.status === "fulfilled" ? emailResult.value.status : "FAILED";
      smsDelivery = smsResult.status === "fulfilled" ? smsResult.value.status : "FAILED";
    }
    credential = "";
    if (delivery === "FAILED" || smsDelivery === "FAILED") await AuditLogModel.create({ actorId: user.id, action: "TENANT_CREDENTIAL_NOTIFICATION_FAILED", entity: "Tenant", entityId: tenantId, meta: { pgId, email: delivery, sms: smsDelivery } }).catch(() => undefined);
    return Response.json({ tenant: { id: tenantId, name: parsed.data.name }, credentialsDelivery: delivery, smsDelivery }, { status: 201 });
  } catch (error) {
    credential = "";
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "PG_NOT_AVAILABLE") return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    if (error instanceof Error && error.message === "ROOM_NOT_AVAILABLE") return Response.json({ error: { message: "Choose a room from your PG" } }, { status: 400 });
    if (error instanceof Error && error.message === "ROOM_FULL") return Response.json({ error: { message: "This room has no free beds" } }, { status: 409 });
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") return Response.json({ error: { message: "An uploaded image expired or is unavailable; upload it again" } }, { status: 400 });
    if (error instanceof Error && error.message === "AADHAAR_CONSENT_REQUIRED") return Response.json({ error: { message: "Consent is required before storing the Aadhaar image" } }, { status: 400 });
    if (isDuplicateKeyError(error)) return Response.json({ error: { message: "An account with this email already exists" } }, { status: 409 });
    return Response.json({ error: { message: "Tenant could not be added" } }, { status: 500 });
  }
}
