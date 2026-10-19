import { Types } from "mongoose";

import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { RoomModel } from "@/server/db/models/room";
import { TenantModel } from "@/server/db/models/tenant";

export async function GET(_request: Request, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { tenantId } = await context.params;
    if (!Types.ObjectId.isValid(tenantId)) return Response.json({ error: { message: "Tenant was not found" } }, { status: 404 });
    await connectToDatabase();
    const tenant = await TenantModel.findOne({ _id: tenantId, pgId }).lean();
    if (!tenant) return Response.json({ error: { message: "Tenant was not found" } }, { status: 404 });
    const room = await RoomModel.findOne({ _id: tenant.roomId, pgId }).populate("roomTypeId", "name sharing ac attachedBath rent deposit").lean();
    const type = room?.roomTypeId as unknown as { name?: string; sharing?: number; ac?: boolean; attachedBath?: boolean; rent?: number; deposit?: number } | null;
    const profilePhotoUrl = tenant.profilePhoto ? `/api/owner/tenants/${tenant._id.toString()}/photo` : "";
    return Response.json({ tenant: {
      id: tenant._id.toString(), name: tenant.name, email: tenant.email, phone: tenant.phone, status: tenant.status,
      joinedAt: tenant.joinedAt.toISOString(), vacatedAt: tenant.vacatedAt?.toISOString() ?? null,
      monthlyRentPaise: tenant.monthlyRent, depositPaise: tenant.deposit, parents: tenant.parents,
      profilePhotoUrl, hasAadhaar: Boolean(tenant.aadhaarCard),
      room: room ? { roomNumber: room.roomNumber, floor: room.floor, block: room.block ?? "", capacity: room.capacity, type: type?.name ?? "Unknown", sharing: type?.sharing ?? 1, ac: Boolean(type?.ac), attachedBath: Boolean(type?.attachedBath) } : null,
    } });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Tenant details could not be loaded" } }, { status: 500 });
  }
}
