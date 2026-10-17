import mongoose, { Types } from "mongoose";

import { roomTypeInputSchema } from "@/lib/owner-schemas";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { RoomTypeModel, type RoomTypeRecord } from "@/server/db/models/room-type";
import { type PgAsset } from "@/server/db/models/pg";
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
  if (new Set(photos.map((photo) => photo.publicId)).size !== photos.length) {
    throw new Error("DUPLICATE_PHOTOS");
  }
  return { photos, uploadIds };
}

export async function GET() {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    await connectToDatabase();
    const roomTypes = await RoomTypeModel.find({ pgId }).sort({ createdAt: 1 }).lean();
    return Response.json({ roomTypes: roomTypes.map((item) => serializeRoomType(item as never)) });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "Room types could not be loaded" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const parsed = roomTypeInputSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) {
      return Response.json({
        error: { message: "Review the room type fields", fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
      }, { status: 400 });
    }
    await connectToDatabase();
    const session = await mongoose.startSession();
    let created: RoomTypeRecord & { _id: Types.ObjectId } | null = null;
    try {
      await session.withTransaction(async () => {
        const resolved = await resolvePhotos(parsed.data.photos, [], user.id, pgId, session);
        const doc = new RoomTypeModel({
          pgId: new Types.ObjectId(pgId),
          name: parsed.data.name,
          sharing: parsed.data.sharing,
          ac: parsed.data.ac,
          attachedBath: parsed.data.attachedBath,
          rent: parsed.data.rentPaise,
          deposit: parsed.data.depositPaise,
          description: parsed.data.description,
          amenities: parsed.data.amenities,
          photos: resolved.photos,
        });
        await doc.save({ session });
        await claimOwnerUploads({ ids: resolved.uploadIds, ownerId: user.id, pgId, session });
        await AuditLogModel.create([{
          actorId: new Types.ObjectId(user.id),
          action: "ROOM_TYPE_CREATED",
          entity: "RoomType",
          entityId: doc._id,
          meta: { pgId, name: doc.name },
        }], { session });
        created = doc.toObject() as RoomTypeRecord & { _id: Types.ObjectId };
      });
    } finally {
      await session.endSession();
    }
    if (!created) throw new Error("ROOM_TYPE_NOT_CREATED");
    return Response.json({ roomType: serializeRoomType(created) }, { status: 201 });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") return Response.json({ error: { message: "An uploaded room photo expired or is unavailable" } }, { status: 400 });
    if (error instanceof Error && (error.message === "PHOTO_NOT_AVAILABLE" || error.message === "DUPLICATE_PHOTOS")) return Response.json({ error: { message: "A room photo is invalid or repeated" } }, { status: 400 });
    return Response.json({ error: { message: "Room type could not be created" } }, { status: 500 });
  }
}

