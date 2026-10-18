import { Types } from "mongoose";

import { roomInputSchema } from "@/lib/owner-schemas";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { RoomModel } from "@/server/db/models/room";
import { RoomTypeModel } from "@/server/db/models/room-type";

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { roomId } = await context.params;
    if (!Types.ObjectId.isValid(roomId)) return Response.json({ error: { message: "Room was not found" } }, { status: 404 });
    const parsed = roomInputSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Review the room fields", fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } }, { status: 400 });
    await connectToDatabase();
    const roomType = await RoomTypeModel.findOne({ _id: parsed.data.roomTypeId, pgId }).select("sharing").lean();
    if (!roomType) return Response.json({ error: { message: "Choose a room type from your PG" } }, { status: 400 });
    if (parsed.data.capacity > roomType.sharing) return Response.json({ error: { message: "Room capacity cannot exceed the room type sharing limit" } }, { status: 400 });
    const room = await RoomModel.findOneAndUpdate(
      { _id: roomId, pgId, $expr: { $lte: [{ $ifNull: ["$occupiedCount", 0] }, parsed.data.capacity] } },
      { $set: { roomTypeId: parsed.data.roomTypeId, roomNumber: parsed.data.roomNumber, floor: parsed.data.floor, block: parsed.data.block || undefined, capacity: parsed.data.capacity } },
      { returnDocument: "after", runValidators: true },
    );
    if (!room) {
      const exists = await RoomModel.exists({ _id: roomId, pgId });
      return Response.json({ error: { message: exists ? "Room capacity cannot be lower than its current occupancy" : "Room was not found" } }, { status: exists ? 409 : 404 });
    }
    await AuditLogModel.create({ actorId: user.id, action: "ROOM_UPDATED", entity: "Room", entityId: room._id, meta: { pgId, roomNumber: room.roomNumber } });
    return Response.json({ saved: true });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (isDuplicateKeyError(error)) return Response.json({ error: { message: "A room with this block and room number already exists" } }, { status: 409 });
    return Response.json({ error: { message: "Room could not be saved" } }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { roomId } = await context.params;
    if (!Types.ObjectId.isValid(roomId)) return Response.json({ error: { message: "Room was not found" } }, { status: 404 });
    await connectToDatabase();
    const room = await RoomModel.findOneAndDelete({ _id: roomId, pgId, $expr: { $eq: [{ $ifNull: ["$occupiedCount", 0] }, 0] } });
    if (!room) {
      const exists = await RoomModel.exists({ _id: roomId, pgId });
      return Response.json({ error: { message: exists ? "Remove residents from this room before deleting it" : "Room was not found" } }, { status: exists ? 409 : 404 });
    }
    await AuditLogModel.create({ actorId: user.id, action: "ROOM_DELETED", entity: "Room", entityId: room._id, meta: { pgId, roomNumber: room.roomNumber } });
    return Response.json({ deleted: true });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "Room could not be deleted" } }, { status: 500 });
  }
}
