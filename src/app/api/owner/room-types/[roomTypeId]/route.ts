import mongoose, { Types } from "mongoose";

import { roomTypeInputSchema } from "@/lib/owner-schemas";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { RoomModel } from "@/server/db/models/room";
import { RoomTypeModel, type RoomTypeRecord } from "@/server/db/models/room-type";
import type { PgAsset } from "@/server/db/models/pg";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { getStorageProvider } from "@/server/providers/storage";
import { claimOwnerUploads, resolveOwnerPhotoReference } from "@/server/owner/asset-references";

export const runtime = "nodejs";

function serializeRoomType(roomType: RoomTypeRecord & { _id: Types.ObjectId }) {
  return {
    id: roomType._id.toString(),
    name: roomType.name,
    sharing: roomType.sharing,
    ac: roomType.ac,
    attachedBath: roomType.attachedBath,
    rentPaise: roomType.rent,
    depositPaise: roomType.deposit,
    description: roomType.description,
    amenities: roomType.amenities,
    photos: roomType.photos,
  };
}

async function resolvePhotos(
  references: Array<{ assetId?: string; publicId?: string; caption?: string }>,
  existing: PgAsset[],
  userId: string,
  pgId: string,
  session: mongoose.ClientSession,
) {
  const photos: PgAsset[] = [];
  const uploadIds = new Set<string>();
  for (const reference of references) {
    const resolved = await resolveOwnerPhotoReference({
      photo: reference,
      purpose: "ROOM_TYPE_PHOTO",
      existing,
      ownerId: userId,
      pgId,
      visibility: "public",
      session,
    });
    if (resolved.uploadedAssetId) uploadIds.add(resolved.uploadedAssetId);
    photos.push(resolved.asset);
  }
  if (new Set(photos.map((photo) => photo.publicId)).size !== photos.length) throw new Error("DUPLICATE_PHOTOS");
  return { photos, uploadIds };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roomTypeId: string }> },
) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { roomTypeId } = await context.params;
    if (!Types.ObjectId.isValid(roomTypeId)) return Response.json({ error: { message: "Room type was not found" } }, { status: 404 });
    const parsed = roomTypeInputSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) {
      return Response.json({
        error: { message: "Review the room type fields", fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
      }, { status: 400 });
    }
    await connectToDatabase();
    const session = await mongoose.startSession();
    let removed: string[] = [];
    let saved: (RoomTypeRecord & { _id: Types.ObjectId }) | null = null;
    try {
      await session.withTransaction(async () => {
        const roomType = await RoomTypeModel.findOne({ _id: roomTypeId, pgId }).session(session);
        if (!roomType) throw new Error("ROOM_TYPE_NOT_FOUND");
        const oversizedRoom = await RoomModel.exists({ pgId, roomTypeId, capacity: { $gt: parsed.data.sharing } }).session(session);
        if (oversizedRoom) throw new Error("ROOM_CAPACITY_EXCEEDS_SHARING");
        const resolved = await resolvePhotos(parsed.data.photos, roomType.photos, user.id, pgId, session);
        removed = roomType.photos
          .filter((photo) => !resolved.photos.some((next) => next.publicId === photo.publicId))
          .map((photo) => photo.publicId);
        roomType.name = parsed.data.name;
        roomType.sharing = parsed.data.sharing;
        roomType.ac = parsed.data.ac;
        roomType.attachedBath = parsed.data.attachedBath;
        roomType.rent = parsed.data.rentPaise;
        roomType.deposit = parsed.data.depositPaise;
        roomType.description = parsed.data.description;
        roomType.amenities = parsed.data.amenities;
        roomType.photos = resolved.photos as typeof roomType.photos;
        await roomType.save({ session });
        await claimOwnerUploads({ ids: resolved.uploadIds, ownerId: user.id, pgId, session });
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(user.id),
          action: "ROOM_TYPE_UPDATED",
          entity: "RoomType",
          entityId: roomType._id,
          meta: { pgId, name: roomType.name },
        }], { session });
        saved = roomType.toObject() as RoomTypeRecord & { _id: Types.ObjectId };
      });
    } finally {
      await session.endSession();
    }
    if (!saved) throw new Error("ROOM_TYPE_NOT_FOUND");
    let cleanupPending = false;
    for (const publicId of removed) {
      try {
        await getStorageProvider().delete(publicId);
        await TemporaryAssetModel.deleteOne({ pgId, publicId });
      } catch {
        cleanupPending = true;
      }
    }
    return Response.json({ roomType: serializeRoomType(saved), imageCleanup: cleanupPending ? "PENDING" : "COMPLETE" });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (error instanceof Error && error.message === "ROOM_TYPE_NOT_FOUND") return Response.json({ error: { message: "Room type was not found" } }, { status: 404 });
    if (error instanceof Error && error.message === "ROOM_CAPACITY_EXCEEDS_SHARING") return Response.json({ error: { message: "Reduce the capacity of assigned rooms before lowering this sharing limit" } }, { status: 409 });
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") return Response.json({ error: { message: "An uploaded room photo expired or is unavailable" } }, { status: 400 });
    if (error instanceof Error && (error.message === "PHOTO_NOT_AVAILABLE" || error.message === "DUPLICATE_PHOTOS")) return Response.json({ error: { message: "A room photo is invalid or repeated" } }, { status: 400 });
    return Response.json({ error: { message: "Room type could not be saved" } }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ roomTypeId: string }> },
) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { roomTypeId } = await context.params;
    if (!Types.ObjectId.isValid(roomTypeId)) return Response.json({ error: { message: "Room type was not found" } }, { status: 404 });
    await connectToDatabase();
    const session = await mongoose.startSession();
    let photoIds: string[] = [];
    try {
      await session.withTransaction(async () => {
        const roomType = await RoomTypeModel.findOne({ _id: roomTypeId, pgId }).session(session);
        if (!roomType) throw new Error("ROOM_TYPE_NOT_FOUND");
        const assignedRoom = await RoomModel.exists({ pgId, roomTypeId }).session(session);
        if (assignedRoom) throw new Error("ROOM_TYPE_IN_USE");
        photoIds = roomType.photos.map((photo) => photo.publicId);
        await RoomTypeModel.deleteOne({ _id: roomTypeId, pgId }, { session });
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(user.id),
          action: "ROOM_TYPE_DELETED",
          entity: "RoomType",
          entityId: new Types.ObjectId(roomTypeId),
          meta: { pgId, name: roomType.name },
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    for (const publicId of photoIds) {
      await getStorageProvider().delete(publicId);
      await TemporaryAssetModel.deleteOne({ pgId, publicId });
    }
    return Response.json({ deleted: true });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (error instanceof Error && error.message === "ROOM_TYPE_NOT_FOUND") return Response.json({ error: { message: "Room type was not found" } }, { status: 404 });
    if (error instanceof Error && error.message === "ROOM_TYPE_IN_USE") return Response.json({ error: { message: "Remove rooms using this room type before deleting it" } }, { status: 409 });
    return Response.json({ error: { message: "Room type could not be deleted" } }, { status: 500 });
  }
}
