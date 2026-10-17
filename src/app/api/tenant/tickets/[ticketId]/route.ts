import { createHash, timingSafeEqual } from "node:crypto";
import mongoose, { Types } from "mongoose";

import { ticketFeedbackSchema } from "@/lib/ticket-schemas";
import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { TicketModel } from "@/server/db/models/ticket";
import { emailTicketReopened } from "@/server/tickets/notifications";
import { signTicketImages } from "@/server/tickets/assets";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ ticketId: string }> }) {
  try {
    const { user, tenant, pgId } = await requireActiveTenant();
    const { ticketId } = await context.params;
    if (!Types.ObjectId.isValid(ticketId)) return Response.json({ error: { message: "Ticket was not found" } }, { status: 404 });
    await connectToDatabase();
    const ticket = await TicketModel.findOne({ _id: ticketId, tenantId: tenant._id, pgId }).lean();
    if (!ticket) return Response.json({ error: { message: "Ticket was not found" } }, { status: 404 });
    const images = await signTicketImages(ticket.images);
    const proofImages = ticket.resolution?.images ? await signTicketImages(ticket.resolution.images) : [];
    if (images.length || proofImages.length) await AuditLogModel.create({ actorId: user.id, action: "TICKET_IMAGES_VIEWED", entity: "Ticket", entityId: ticket._id, meta: { pgId, tenantId: tenant._id.toString(), imageCount: images.length + proofImages.length } });
    return Response.json({ ticket: {
      id: ticket._id.toString(), title: ticket.title, description: ticket.description, category: ticket.category,
      priority: ticket.priority, status: ticket.status, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(),
      images, resolution: ticket.resolution ? { note: ticket.resolution.note, resolvedAt: ticket.resolution.resolvedAt.toISOString(), images: proofImages } : null,
      feedback: ticket.tenantFeedback ? { approved: ticket.tenantFeedback.approved, comment: ticket.tenantFeedback.comment ?? "", at: ticket.tenantFeedback.at.toISOString() } : null,
      timeline: ticket.timeline.map((entry) => ({ at: entry.at.toISOString(), action: entry.action, note: entry.note ?? "" })),
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
    const { user, tenant, pgId } = await requireActiveTenant();
    const { ticketId } = await context.params;
    if (!Types.ObjectId.isValid(ticketId)) return Response.json({ error: { message: "Ticket was not found" } }, { status: 404 });
    const parsed = ticketFeedbackSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Add a note when the repair is not fixed" } }, { status: 400 });
    await connectToDatabase();
    const session = await mongoose.startSession();
    let ownerNotice: { email: string; name: string; pgName: string; title: string; comment: string } | null = null;
    try {
      ownerNotice = await session.withTransaction(async () => {
        const ticket = await TicketModel.findOne({ _id: ticketId, tenantId: tenant._id, pgId }).select("+approvalTokenHash +approvalTokenExpiresAt").session(session);
        if (!ticket) throw new Error("TICKET_NOT_FOUND");
        if (ticket.status !== "RESOLVED_AWAITING_APPROVAL") throw new Error("TICKET_NOT_AWAITING_APPROVAL");
        if (parsed.data.token) {
          const suppliedHash = createHash("sha256").update(parsed.data.token).digest();
          const storedHash = ticket.approvalTokenHash ? Buffer.from(ticket.approvalTokenHash, "hex") : Buffer.alloc(0);
          if (!ticket.approvalTokenExpiresAt || ticket.approvalTokenExpiresAt <= new Date() || storedHash.length !== suppliedHash.length || !timingSafeEqual(suppliedHash, storedHash)) throw new Error("APPROVAL_LINK_INVALID");
        }
        const now = new Date();
        const comment = parsed.data.comment?.trim() || undefined;
        ticket.tenantFeedback = { approved: parsed.data.approved, comment, at: now };
        ticket.status = parsed.data.approved ? "CLOSED" : "REOPENED";
        ticket.approvalTokenHash = undefined;
        ticket.approvalTokenExpiresAt = undefined;
        ticket.timeline.push({ at: now, by: new Types.ObjectId(user.id), action: parsed.data.approved ? "TENANT_APPROVED" : "TENANT_REOPENED", note: comment });
        await ticket.save({ session });
        await AuditLogModel.create([{ actorId: new Types.ObjectId(user.id), action: parsed.data.approved ? "TICKET_APPROVED" : "TICKET_REOPENED", entity: "Ticket", entityId: ticket._id, meta: { pgId, tenantId: tenant._id.toString(), comment } }], { session });
        if (!parsed.data.approved) {
          const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name owner.name owner.email").session(session).lean();
          if (pg) return { email: pg.owner.email, name: pg.owner.name, pgName: pg.name, title: ticket.title, comment: comment ?? "The issue is still present" };
        }
        return null;
      });
    } finally { await session.endSession(); }
    if (ownerNotice) await emailTicketReopened({ to: ownerNotice.email, ownerName: ownerNotice.name, pgName: ownerNotice.pgName, ticketId, title: ownerNotice.title, comment: ownerNotice.comment });
    return Response.json({ updated: true, status: parsed.data.approved ? "CLOSED" : "REOPENED", ownerNotified: Boolean(ownerNotice) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "TICKET_NOT_FOUND") return Response.json({ error: { message: "Ticket was not found" } }, { status: 404 });
    if (error instanceof Error && error.message === "TICKET_NOT_AWAITING_APPROVAL") return Response.json({ error: { message: "This ticket is not waiting for your approval" } }, { status: 409 });
    if (error instanceof Error && error.message === "APPROVAL_LINK_INVALID") return Response.json({ error: { message: "This approval link has expired or was already used" } }, { status: 410 });
    return Response.json({ error: { message: "Ticket feedback could not be saved" } }, { status: 500 });
  }
}
