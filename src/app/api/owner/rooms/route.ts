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

export async function GET() {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    await connectToDatabase();
    const rooms = await RoomModel.find({ pgId }).sort({ floor: 1, block: 1, roomNumber: 1 }).populate("roomTypeId", "name sharing ac attachedBath rent deposit").lean();
    return Response.json({ rooms: rooms.map((room) => {
      const type = room.roomTypeId as unknown as { _id?: Types.ObjectId; name?: string; sharing?: number; ac?: boolean; attachedBath?: boolean; rent?: number; deposit?: number } | null;
      return {
        id: room._id.toString(),
        roomNumber: room.roomNumber,
        floor: room.floor,
        block: room.block ?? "",
        capacity: room.capacity,
        roomType: type && typeof type === "object" && type.name
          ? { id: type._id?.toString() ?? "", name: type.name, sharing: type.sharing ?? 1, ac: Boolean(type.ac), attachedBath: Boolean(type.attachedBath), rentPaise: type.rent ?? 0, depositPaise: type.deposit ?? 0 }
          : null,
        occupiedCount: 0,
        freeBeds: room.capacity,
        occupants: [],
      };
    }) });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "Rooms could not be loaded" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const parsed = roomInputSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Review the room fields", fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } }, { status: 400 });
    await connectToDatabase();
    const roomType = await RoomTypeModel.findOne({ _id: parsed.data.roomTypeId, pgId }).select("sharing").lean();
    if (!roomType) return Response.json({ error: { message: "Choose a room type from your PG" } }, { status: 400 });
    if (parsed.data.capacity > roomType.sharing) return Response.json({ error: { message: "Room capacity cannot exceed the room type sharing limit" } }, { status: 400 });
    const room = await RoomModel.create({
      pgId: new Types.ObjectId(pgId),
      roomTypeId: new Types.ObjectId(parsed.data.roomTypeId),
      roomNumber: parsed.data.roomNumber,
      floor: parsed.data.floor,
      block: parsed.data.block || undefined,
      capacity: parsed.data.capacity,
    });
    await AuditLogModel.create({ actorId: user.id, action: "ROOM_CREATED", entity: "Room", entityId: room._id, meta: { pgId, roomNumber: room.roomNumber } });
    return Response.json({ room: { id: room._id.toString(), roomNumber: room.roomNumber } }, { status: 201 });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (isDuplicateKeyError(error)) return Response.json({ error: { message: "A room with this block and room number already exists" } }, { status: 409 });
    return Response.json({ error: { message: "Room could not be created" } }, { status: 500 });
  }
}
