import mongoose from "mongoose";

import { tenantProfileSchema } from "@/lib/ticket-schemas";
import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel } from "@/server/db/models/pg";
import { ReviewModel } from "@/server/db/models/review";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { TenantModel } from "@/server/db/models/tenant";
import { UserModel } from "@/server/db/models/user";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { getStorageProvider } from "@/server/providers/storage";

export async function GET() {
  try {
    const { tenant, pgId } = await requireActiveTenant();
    await connectToDatabase();
    const [review, pg] = await Promise.all([
      ReviewModel.findOne({ pgId, tenantId: tenant._id }).lean(),
      PgModel.findOne({ _id: pgId }).select("name").lean(),
    ]);
    const profilePhotoUrl = tenant.profilePhoto ? "/api/tenant/profile/photo" : "";
    return Response.json({ profile: { name: tenant.name, phone: tenant.phone, email: tenant.email, profilePhotoUrl, pgName: pg?.name ?? "" }, review: review ? { rating: review.rating, comment: review.comment ?? "" } : null });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Profile could not be loaded" } }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const { user, tenant, pgId } = await requireActiveTenant();
    const parsed = tenantProfileSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Enter a valid phone number and profile photo" } }, { status: 400 });
    await connectToDatabase();
    const session = await mongoose.startSession();
    const previousPhotoId = tenant.profilePhoto?.publicId;
    let newPhotoId: string | undefined;
    try {
      await session.withTransaction(async () => {
        let photo = tenant.profilePhoto;
        if (parsed.data.profilePhotoAssetId === null) photo = undefined;
        if (parsed.data.profilePhotoAssetId) {
          const asset = await TemporaryAssetModel.findOne({
            _id: parsed.data.profilePhotoAssetId, ownerUserId: user.id, pgId, purpose: "TENANT_PROFILE",
            visibility: "private", resourceType: "image", claimedAt: { $exists: false }, expiresAt: { $gt: new Date() },
          }).session(session).lean();
          if (!asset) throw new Error("UPLOAD_NOT_AVAILABLE");
          const claim = await TemporaryAssetModel.updateOne({ _id: asset._id, ownerUserId: user.id, pgId, claimedAt: { $exists: false } }, { $set: { claimedAt: new Date() } }, { session });
          if (claim.modifiedCount !== 1) throw new Error("UPLOAD_NOT_AVAILABLE");
          photo = { publicId: asset.publicId, url: asset.url };
          newPhotoId = asset.publicId;
        }
        await TenantModel.updateOne(
          { _id: tenant._id, pgId, userId: user.id, status: "ACTIVE" },
          { $set: { phone: parsed.data.phone, ...(parsed.data.profilePhotoAssetId === null ? {} : { profilePhoto: photo }) }, ...(parsed.data.profilePhotoAssetId === null ? { $unset: { profilePhoto: 1 } } : {}) },
          { session },
        );
        await UserModel.updateOne({ _id: user.id, pgId, role: "TENANT" }, { $set: { phone: parsed.data.phone } }, { session });
        await AuditLogModel.create([{ actorId: user.id, action: "TENANT_PROFILE_UPDATED", entity: "Tenant", entityId: tenant._id, meta: { pgId, phoneChanged: parsed.data.phone !== tenant.phone, profilePhotoChanged: parsed.data.profilePhotoAssetId !== undefined } }], { session });
      });
    } finally { await session.endSession(); }
    if (previousPhotoId && previousPhotoId !== newPhotoId && parsed.data.profilePhotoAssetId !== undefined) {
      try {
        await getStorageProvider().delete(previousPhotoId);
        await TemporaryAssetModel.deleteMany({ pgId, publicId: previousPhotoId });
      } catch { /* The old private photo remains available for cleanup if storage is temporarily unavailable. */ }
    }
    return Response.json({ updated: true });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") return Response.json({ error: { message: "The profile photo upload expired; upload it again" } }, { status: 400 });
    return Response.json({ error: { message: "Profile could not be updated" } }, { status: 500 });
  }
}
