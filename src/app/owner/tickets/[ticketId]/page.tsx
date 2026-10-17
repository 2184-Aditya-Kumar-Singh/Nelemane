import { notFound } from "next/navigation";
import { Types } from "mongoose";

import { requirePgScope, requireRoles } from "@/server/auth/authorization";
import { TicketModel } from "@/server/db/models/ticket";
import { OwnerTicketDetail } from "./ticket-detail";

export const dynamic = "force-dynamic";

export default async function OwnerTicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const user = await requireRoles("PG_OWNER");
  const pgId = requirePgScope(user);
  const { ticketId } = await params;
  if (!Types.ObjectId.isValid(ticketId) || !await TicketModel.exists({ _id: ticketId, pgId })) notFound();
  return <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Resident support</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Ticket details</h1><OwnerTicketDetail ticketId={ticketId} /></main>;
}
