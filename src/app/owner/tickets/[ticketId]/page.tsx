import { notFound } from "next/navigation";
import { Types } from "mongoose";

import { requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { RoomModel } from "@/server/db/models/room";
import { TenantModel } from "@/server/db/models/tenant";
import { TicketModel } from "@/server/db/models/ticket";
import { OwnerTicketDetail, type OwnerTicket } from "./ticket-detail";

export const dynamic = "force-dynamic";

export default async function OwnerTicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const user = await requireRoles("PG_OWNER");
  const pgId = requirePgScope(user);
  const { ticketId } = await params;
  if (!Types.ObjectId.isValid(ticketId)) notFound();
  await connectToDatabase();
  const ticket = await TicketModel.findOne({ _id: ticketId, pgId }).lean();
  if (!ticket) notFound();

  const [tenant, room] = await Promise.all([
    TenantModel.findOne({ _id: ticket.tenantId, pgId }).select("name email phone roomId").lean().catch(() => null),
    RoomModel.findOne({ _id: ticket.roomId, pgId }).select("roomNumber").lean().catch(() => null),
  ]);
  const images = (ticket.images ?? []).map((_, index) => `/api/owner/tickets/${ticket._id.toString()}/image?group=ticket&index=${index}`);
  const proofImages = (ticket.resolution?.images ?? []).map((_, index) => `/api/owner/tickets/${ticket._id.toString()}/image?group=resolution&index=${index}`);

  const initialTicket: OwnerTicket = {
    id: ticket._id.toString(),
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    images,
    resolution: ticket.resolution ? {
      note: ticket.resolution.note,
      resolvedAt: ticket.resolution.resolvedAt?.toISOString() ?? ticket.updatedAt.toISOString(),
      images: proofImages,
    } : null,
    feedback: ticket.tenantFeedback ? {
      approved: ticket.tenantFeedback.approved,
      comment: ticket.tenantFeedback.comment ?? "",
      at: ticket.tenantFeedback.at.toISOString(),
    } : null,
    timeline: (ticket.timeline ?? []).map((entry) => ({
      at: entry.at.toISOString(),
      action: entry.action,
      note: entry.note ?? "",
    })),
    tenant: tenant ? {
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone ?? "",
      room: room?.roomNumber ?? "—",
    } : null,
  };

  return <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Resident support</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Ticket details</h1><OwnerTicketDetail initialTicket={initialTicket} /></main>;
}
