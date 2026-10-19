import { Types } from "mongoose";

import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { TicketModel } from "@/server/db/models/ticket";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ ticketId: string }> }) {
  try {
    const { user, tenant, pgId } = await requireActiveTenant();
    const { ticketId } = await context.params;
    if (!Types.ObjectId.isValid(ticketId)) return Response.json({ error: { message: "Ticket image was not found" } }, { status: 404 });
    const params = new URL(request.url).searchParams;
    const group = params.get("group");
    const index = Number(params.get("index"));
    if ((group !== "ticket" && group !== "resolution") || !Number.isInteger(index) || index < 0 || index >= 5) {
      return Response.json({ error: { message: "Ticket image was not found" } }, { status: 404 });
    }
    await connectToDatabase();
    const ticket = await TicketModel.findOne({ _id: ticketId, tenantId: tenant._id, pgId }).select("images resolution.images").lean();
    const image = group === "ticket" ? ticket?.images?.[index] : ticket?.resolution?.images?.[index];
    if (!ticket || !image) return Response.json({ error: { message: "Ticket image was not found" } }, { status: 404 });
    const response = await privateImageResponse(image.publicId);
    if (!response.ok) return response;
    await AuditLogModel.create({ actorId: new Types.ObjectId(user.id), action: "TICKET_IMAGES_VIEWED", entity: "Ticket", entityId: ticket._id, meta: { pgId, tenantId: tenant._id.toString(), group, index } });
    return response;
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Ticket image could not be opened" } }, { status: 500 });
  }
}
