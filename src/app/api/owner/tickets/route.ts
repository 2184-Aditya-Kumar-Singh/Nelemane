import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { TicketModel, type TicketStatus } from "@/server/db/models/ticket";
import { TenantModel } from "@/server/db/models/tenant";
import { RoomModel } from "@/server/db/models/room";

export async function GET(request: Request) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    await connectToDatabase();
    const status = new URL(request.url).searchParams.get("status");
    const validStatuses: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED_AWAITING_APPROVAL", "CLOSED", "REOPENED"];
    const filter: { status?: TicketStatus } = status && validStatuses.includes(status as TicketStatus) ? { status: status as TicketStatus } : {};
    const tickets = await TicketModel.find({ pgId, ...filter }).sort({ updatedAt: -1 }).limit(200).lean();
    const tenantIds = [...new Set(tickets.map((ticket) => ticket.tenantId.toString()))];
    const tenants = await TenantModel.find({ _id: { $in: tenantIds }, pgId }).select("name roomId").lean();
    const roomIds = [...new Set(tenants.map((tenant) => tenant.roomId.toString()))];
    const rooms = await RoomModel.find({ _id: { $in: roomIds }, pgId }).select("roomNumber").lean();
    const tenantById = new Map(tenants.map((tenant) => [tenant._id.toString(), tenant]));
    const roomById = new Map(rooms.map((room) => [room._id.toString(), room]));
    return Response.json({ tickets: tickets.map((ticket) => {
      const tenant = tenantById.get(ticket.tenantId.toString());
      const room = tenant ? roomById.get(tenant.roomId.toString()) : null;
      return { id: ticket._id.toString(), title: ticket.title, category: ticket.category, priority: ticket.priority, status: ticket.status, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(), tenantName: tenant?.name ?? "Resident", roomNumber: room?.roomNumber ?? "—" };
    }) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Tickets could not be loaded" } }, { status: 500 });
  }
}
