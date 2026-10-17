import { createHash, randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";

import { ticketProgressSchema, ticketResolutionSchema } from "@/lib/ticket-schemas";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { RoomModel } from "@/server/db/models/room";
import { TenantModel } from "@/server/db/models/tenant";
import { TicketModel } from "@/server/db/models/ticket";
import { emailTicketResolved } from "@/server/tickets/notifications";
import { claimTicketImages, signTicketImages } from "@/server/tickets/assets";
import { getStorageProvider } from "@/server/providers/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ ticketId: string }> }) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { ticketId } = await context.params;
    if (!Types.ObjectId.isValid(ticketId)) return Response.json({ error: { message: "Ticket was not found" } }, { status: 404 });
    await connectToDatabase();
    const ticket = await TicketModel.findOne({ _id: ticketId, pgId }).lean();
    if (!ticket) return Response.json({ error: { message: "Ticket was not found" } }, { status: 404 });
    const [tenant, room] = await Promise.all([
      TenantModel.findOne({ _id: ticket.tenantId, pgId }).select("name email phone roomId").lean(),
      RoomModel.findOne({ _id: ticket.roomId, pgId }).select("roomNumber floor block").lean(),
    ]);
    const images = await Promise.all(ticket.images.map(async (image) => await getStorageProvider().getSignedUrl(image.publicId, 60)));
    const proofImages = ticket.resolution?.images ? await signTicketImages(ticket.resolution.images) : [];
    if (ticket.images.length || proofImages.length) await AuditLogModel.create({ actorId: user.id, action: "TICKET_IMAGES_VIEWED", entity: "Ticket", entityId: ticket._id, meta: { pgId, tenantId: ticket.tenantId.toString(), imageCount: images.length + proofImages.length } });
    return Response.json({ ticket: {
      id: ticket._id.toString(), title: ticket.title, description: ticket.description, category: ticket.category, priority: ticket.priority,
      status: ticket.status, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(),
      images, resolution: ticket.resolution ? { note: ticket.resolution.note, resolvedAt: ticket.resolution.resolvedAt.toISOString(), images: proofImages } : null,
      feedback: ticket.tenantFeedback ? { approved: ticket.tenantFeedback.approved, comment: ticket.tenantFeedback.comment ?? "", at: ticket.tenantFeedback.at.toISOString() } : null,
      timeline: ticket.timeline.map((entry) => ({ at: entry.at.toISOString(), action: entry.action, note: entry.note ?? "" })),
      tenant: tenant ? { name: tenant.name, email: tenant.email, phone: tenant.phone, room: room?.roomNumber ?? "—" } : null,
    } });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Ticket could not be loaded" } }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ ticketId: string }> }) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { ticketId } = await context.params;
    if (!Types.ObjectId.isValid(ticketId)) return Response.json({ error: { message: "Ticket was not found" } }, { status: 404 });
    const body = await request.json() as unknown;
    const action = typeof body === "object" && body !== null && "action" in body ? body.action : null;
    const progress = action === "IN_PROGRESS" ? ticketProgressSchema.safeParse(body) : null;
    const resolution = action === "RESOLVE" ? ticketResolutionSchema.safeParse(body) : null;
    if (!progress?.success && !resolution?.success) return Response.json({ error: { message: "Choose a valid ticket action and provide the required details" } }, { status: 400 });
    await connectToDatabase();
    const session = await mongoose.startSession();
    let approval: { token: string; email: string; tenantName: string; pgName: string; title: string } | null = null;
    try {
      approval = await session.withTransaction(async () => {
        const ticket = await TicketModel.findOne({ _id: ticketId, pgId }).session(session);
        if (!ticket) throw new Error("TICKET_NOT_FOUND");
        const now = new Date();
        if (progress?.success) {
          if (!(ticket.status === "OPEN" || ticket.status === "REOPENED")) throw new Error("TICKET_INVALID_TRANSITION");
          ticket.status = "IN_PROGRESS";
          ticket.timeline.push({ at: now, by: new Types.ObjectId(user.id), action: "MARKED_IN_PROGRESS" });
          await ticket.save({ session });
          await AuditLogModel.create([{ actorId: new Types.ObjectId(user.id), action: "TICKET_MARKED_IN_PROGRESS", entity: "Ticket", entityId: ticket._id, meta: { pgId } }], { session });
          return null;
        }
        if (!resolution?.success) throw new Error("TICKET_INVALID_TRANSITION");
        if (ticket.status !== "IN_PROGRESS") throw new Error("TICKET_INVALID_TRANSITION");
        const images = await claimTicketImages({ assetIds: resolution.data.imageAssetIds, purpose: "OWNER_TICKET_PROOF", ownerId: user.id, pgId, session });
        const token = randomBytes(32).toString("base64url");
        ticket.status = "RESOLVED_AWAITING_APPROVAL";
        ticket.resolution = { note: resolution.data.note, images, resolvedAt: now };
        ticket.approvalTokenHash = createHash("sha256").update(token).digest("hex");
        ticket.approvalTokenExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        ticket.timeline.push({ at: now, by: new Types.ObjectId(user.id), action: "MARKED_SOLVED", note: resolution.data.note });
        await ticket.save({ session });
        const [tenant, pg] = await Promise.all([
          TenantModel.findOne({ _id: ticket.tenantId, pgId }).select("name email").session(session).lean(),
          PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name").session(session).lean(),
        ]);
        if (!tenant || !pg) throw new Error("TICKET_CONTEXT_NOT_FOUND");
        await AuditLogModel.create([{ actorId: new Types.ObjectId(user.id), action: "TICKET_MARKED_SOLVED", entity: "Ticket", entityId: ticket._id, meta: { pgId, proofImageCount: images.length } }], { session });
        return { token, email: tenant.email, tenantName: tenant.name, pgName: pg.name, title: ticket.title };
      });
    } finally { await session.endSession(); }
    if (approval) await emailTicketResolved({ to: approval.email, tenantName: approval.tenantName, pgName: approval.pgName, ticketId, title: approval.title, token: approval.token });
    return Response.json({ updated: true, status: approval ? "RESOLVED_AWAITING_APPROVAL" : "IN_PROGRESS", tenantNotified: Boolean(approval) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "TICKET_NOT_FOUND") return Response.json({ error: { message: "Ticket was not found" } }, { status: 404 });
    if (error instanceof Error && error.message === "TICKET_CONTEXT_NOT_FOUND") return Response.json({ error: { message: "Tenant or PG contact details are unavailable" } }, { status: 404 });
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") return Response.json({ error: { message: "One or more proof photos expired; upload them again" } }, { status: 400 });
    if (error instanceof Error && error.message === "TICKET_INVALID_TRANSITION") return Response.json({ error: { message: "This ticket cannot move to that status from its current status" } }, { status: 409 });
    return Response.json({ error: { message: "Ticket could not be updated" } }, { status: 500 });
  }
}
