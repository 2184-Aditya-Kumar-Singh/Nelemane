import mongoose, { Types } from "mongoose";

import { ownerPgDetailsSchema, type ownerPhotoReferenceSchema } from "@/lib/owner-schemas";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel, type PgAsset } from "@/server/db/models/pg";
import { RoomTypeModel } from "@/server/db/models/room-type";
import { TemporaryAssetModel, type UploadPurpose } from "@/server/db/models/temporary-asset";
import { getStorageProvider } from "@/server/providers/storage";

type PhotoReference = typeof ownerPhotoReferenceSchema._output;

async function resolvePhoto(
  photo: PhotoReference,
  purpose: UploadPurpose,
  existing: PgAsset[],
  ownerId: string,
  pgId: string,
  session: mongoose.ClientSession,
): Promise<{ asset: PgAsset; assetId?: string }> {
  if (photo.assetId) {
    const upload = await TemporaryAssetModel.findOne({
      _id: photo.assetId,
      ownerUserId: ownerId,
      pgId,
      purpose,
      visibility: "public",
      claimedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }).session(session).lean();
    if (!upload) throw new Error("UPLOAD_NOT_AVAILABLE");
    return {
      asset: { publicId: upload.publicId, url: upload.url },
      assetId: upload._id.toString(),
    };
  }

  const found = existing.find((asset) => asset.publicId === photo.publicId);
  if (!found) throw new Error("PHOTO_NOT_AVAILABLE");
  return { asset: found };
}

function duplicatePhotoIds(photos: PgAsset[]): boolean {
  return new Set(photos.map((photo) => photo.publicId)).size !== photos.length;
}

export async function GET() {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    await connectToDatabase();
    const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).lean();
    if (!pg) return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    const roomTypes = await RoomTypeModel.countDocuments({ pgId });
    const missing: string[] = [];
    if (!pg.profilePhoto) missing.push("PG profile picture");
    if (pg.description.trim().length < 40) missing.push("Description");
    if (!pg.facilities.length && !pg.customFacilities.length) missing.push("Facilities");
    if (!pg.photos.length) missing.push("Gallery photos");
    if (!pg.houseRules.trim()) missing.push("House rules");
    if (!roomTypes) missing.push("Room types");
    if (!pg.paymentDetails.qrImage && !pg.paymentDetails.qrAccounts?.length && !pg.paymentDetails.bank) missing.push("Payment details");
    const total = 7;
    const complete = total - missing.length;

    return Response.json({
      pg: {
        id: pg._id.toString(),
        name: pg.name,
        address: pg.address,
        gstNumber: pg.gstNumber ?? "",
        profilePhoto: pg.profilePhoto ?? null,
        description: pg.description,
        gender: pg.gender,
        facilities: pg.facilities,
        customFacilities: pg.customFacilities,
        houseRules: pg.houseRules,
        photos: pg.photos.map((photo) => ({ ...photo, caption: photo.caption ?? "" })),
        rentWindow: pg.rentWindow,
        reminder: pg.reminder,
        isListed: pg.isListed,
        subscriptionStatus: pg.subscription.status,
        completeness: { percent: Math.round((complete / total) * 100), missing },
        updatedAt: pg.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "PG details could not be loaded" } }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const parsed = ownerPgDetailsSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) {
      return Response.json({
        error: {
          message: "Review the highlighted PG details",
          fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      }, { status: 400 });
    }

    await connectToDatabase();
    const session = await mongoose.startSession();
    let removedAssetIds: string[] = [];
    try {
      await session.withTransaction(async () => {
        const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).session(session);
        if (!pg) throw new Error("PG_NOT_AVAILABLE");
        if (parsed.data.isListed && pg.subscription.status !== "ACTIVE") throw new Error("SUBSCRIPTION_INACTIVE");

        const uploadIds = new Set<string>();
        let nextProfilePhoto: PgAsset | undefined = pg.profilePhoto;
        if (parsed.data.profilePhoto !== undefined) {
          if (parsed.data.profilePhoto === null) nextProfilePhoto = undefined;
          else {
            const resolved = await resolvePhoto(parsed.data.profilePhoto, "OWNER_PG_PROFILE", [pg.profilePhoto].filter((asset): asset is PgAsset => Boolean(asset)), user.id, pgId, session);
            nextProfilePhoto = resolved.asset;
            if (resolved.assetId) uploadIds.add(resolved.assetId);
          }
        }

        const gallery: PgAsset[] = [];
        for (const reference of parsed.data.photos) {
          const resolved = await resolvePhoto(reference, "PG_GALLERY", pg.photos, user.id, pgId, session);
          if (resolved.assetId) uploadIds.add(resolved.assetId);
          gallery.push({ ...resolved.asset, caption: reference.caption ?? "" } as PgAsset);
        }
        if (duplicatePhotoIds(gallery)) throw new Error("DUPLICATE_PHOTOS");

        const oldAssets = [pg.profilePhoto, ...pg.photos].filter((asset): asset is PgAsset => Boolean(asset));
        const nextAssets = [nextProfilePhoto, ...gallery].filter((asset): asset is PgAsset => Boolean(asset));
        removedAssetIds = oldAssets
          .filter((asset) => !nextAssets.some((next) => next.publicId === asset.publicId))
          .map((asset) => asset.publicId);

        pg.profilePhoto = nextProfilePhoto;
        pg.description = parsed.data.description;
        pg.gender = parsed.data.gender;
        pg.facilities = parsed.data.facilities;
        pg.customFacilities = [...new Set(parsed.data.customFacilities.map((value) => value.trim()).filter(Boolean))];
        pg.houseRules = parsed.data.houseRules;
        pg.photos = gallery as typeof pg.photos;
        pg.rentWindow = parsed.data.rentWindow;
        pg.reminder = parsed.data.reminder;
        pg.isListed = parsed.data.isListed;
        await pg.save({ session });

        for (const assetId of uploadIds) {
          const result = await TemporaryAssetModel.updateOne(
            { _id: assetId, ownerUserId: user.id, pgId, claimedAt: { $exists: false } },
            { $set: { claimedAt: new Date() } },
            { session },
          );
          if (result.modifiedCount !== 1) throw new Error("UPLOAD_NOT_AVAILABLE");
        }

        await AuditLogModel.create([{
          actorId: new Types.ObjectId(user.id),
          action: "PG_DETAILS_UPDATED",
          entity: "PG",
          entityId: new Types.ObjectId(pgId),
          meta: { isListed: pg.isListed, facilitiesCount: pg.facilities.length + pg.customFacilities.length, galleryCount: pg.photos.length },
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    let cleanupFailed = false;
    for (const publicId of removedAssetIds) {
      try {
        await getStorageProvider().delete(publicId);
        await TemporaryAssetModel.deleteOne({ pgId, publicId });
      } catch {
        cleanupFailed = true;
      }
    }
    return Response.json({ saved: true, imageCleanup: cleanupFailed ? "PENDING" : "COMPLETE" });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (error instanceof Error && error.message === "PG_NOT_AVAILABLE") return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    if (error instanceof Error && error.message === "SUBSCRIPTION_INACTIVE") return Response.json({ error: { message: "Reactivate the subscription before making the PG publicly visible" } }, { status: 409 });
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") return Response.json({ error: { message: "An uploaded image expired or is unavailable; upload it again" } }, { status: 400 });
    if (error instanceof Error && (error.message === "PHOTO_NOT_AVAILABLE" || error.message === "DUPLICATE_PHOTOS")) return Response.json({ error: { message: "A gallery photo is invalid or repeated" } }, { status: 400 });
    return Response.json({ error: { message: "PG details could not be saved" } }, { status: 500 });
  }
}
