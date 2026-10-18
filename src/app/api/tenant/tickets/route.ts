import mongoose, { Types } from "mongoose";

import { ticketCreateSchema } from "@/lib/ticket-schemas";
import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { TicketCreationQuotaModel } from "@/server/db/models/ticket-creation-quota";
import { TicketModel } from "@/server/db/models/ticket";
import { emailTicketCreated } from "@/server/tickets/notifications";
import { claimTicketImages } from "@/server/tickets/assets";
import { getIstDateParts } from "@/server/payments/dates";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { tenant, pgId } = await requireActiveTenant();
    await connectToDatabase();
    const tickets = await TicketModel.find({ pgId, tenantId: tenant._id }).sort({ updatedAt: -1 }).limit(100).lean();
    return Response.json({ tickets: tickets.map((ticket) => ({
      id: ticket._id.toString(), title: ticket.title, category: ticket.category, priority: ticket.priority,
      status: ticket.status, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(),
      resolution: ticket.resolution ? { note: ticket.resolution.note, images: ticket.resolution.images.length ? ticket.resolution.images.length : 0 } : null,
      timeline: ticket.timeline.map((entry) => ({ at: entry.at.toISOString(), action: entry.action, note: entry.note ?? "" })),
    })) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Tickets could not be loaded" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const { user, tenant, pgId } = await requireActiveTenant();
    const parsed = ticketCreateSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Review the ticket details", fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } }, { status: 400 });
    await connectToDatabase();
    const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name owner.email owner.name").lean();
    if (!pg) return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    const session = await mongoose.startSession();
    let ticketId = "";
    try {
      await session.withTransaction(async () => {
        const dayKey = getIstDateParts().key;
        let quota = await TicketCreationQuotaModel.findOneAndUpdate(
          { tenantId: tenant._id, dayKey, count: { $lt: 5 } }, { $inc: { count: 1 } }, { returnDocument: "after", session },
        );
        if (!quota) {
          if (await TicketCreationQuotaModel.exists({ tenantId: tenant._id, dayKey }).session(session)) throw new Error("DAILY_TICKET_LIMIT");
          quota = (await TicketCreationQuotaModel.create([{ tenantId: tenant._id, dayKey, count: 1 }], { session }))[0] ?? null;
        }
        if (!quota) throw new Error("DAILY_TICKET_LIMIT");
        const images = await claimTicketImages({ assetIds: parsed.data.imageAssetIds, purpose: "TICKET_IMAGE", ownerId: user.id, pgId, session });
        const created = await TicketModel.create([{
          pgId: new Types.ObjectId(pgId), tenantId: tenant._id, roomId: tenant.roomId,
          title: parsed.data.title, description: parsed.data.description, category: parsed.data.category,
          priority: parsed.data.priority, images, status: "OPEN",
          timeline: [{ at: new Date(), by: new Types.ObjectId(user.id), action: "TICKET_CREATED" }],
        }], { session });
        ticketId = created[0]!._id.toString();
        await AuditLogModel.create([{ actorId: new Types.ObjectId(user.id), action: "TICKET_CREATED", entity: "Ticket", entityId: created[0]!._id, meta: { pgId, tenantId: tenant._id.toString(), category: parsed.data.category, imageCount: images.length } }], { session });
      });
    } finally { await session.endSession(); }
    const notification = await emailTicketCreated({ to: pg.owner.email, ownerName: pg.owner.name, pgName: pg.name, tenantName: tenant.name, ticketId, title: parsed.data.title });
    return Response.json({ ticket: { id: ticketId, status: "OPEN" }, ownerNotification: notification.status }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "DAILY_TICKET_LIMIT") return Response.json({ error: { message: "You have reached the limit of 5 ticket submissions today" } }, { status: 429 });
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") return Response.json({ error: { message: "One or more photos expired; upload them again" } }, { status: 400 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return Response.json({ error: { message: "Ticket submissions are processing; please try again" } }, { status: 429 });
    return Response.json({ error: { message: "Ticket could not be created" } }, { status: 500 });
  }
}
