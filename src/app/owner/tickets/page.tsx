import Link from "next/link";

import { requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { RoomModel } from "@/server/db/models/room";
import { TenantModel } from "@/server/db/models/tenant";
import { TicketModel, type TicketStatus } from "@/server/db/models/ticket";

export const dynamic = "force-dynamic";
const statuses = [["", "All"], ["OPEN", "Open"], ["IN_PROGRESS", "In progress"], ["RESOLVED_AWAITING_APPROVAL", "Awaiting approval"], ["REOPENED", "Reopened"], ["CLOSED", "Closed"]] as const;
const labels: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED_AWAITING_APPROVAL: "Awaiting approval", CLOSED: "Closed", REOPENED: "Reopened" };

export default async function OwnerTicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireRoles("PG_OWNER");
  const pgId = requirePgScope(user);
  await connectToDatabase();
  const { status } = await searchParams;
  const filter: { status?: TicketStatus } = statuses.some(([key]) => key === status) && status ? { status: status as TicketStatus } : {};
  const tickets = await TicketModel.find({ pgId, ...filter }).sort({ updatedAt: -1 }).limit(200).lean();
  const tenantIds = [...new Set(tickets.map((ticket) => ticket.tenantId.toString()))];
  const tenants = await TenantModel.find({ _id: { $in: tenantIds }, pgId }).select("name roomId").lean();
  const roomIds = [...new Set(tenants.map((tenant) => tenant.roomId.toString()))];
  const rooms = await RoomModel.find({ _id: { $in: roomIds }, pgId }).select("roomNumber").lean();
  const tenantMap = new Map(tenants.map((tenant) => [tenant._id.toString(), tenant]));
  const roomMap = new Map(rooms.map((room) => [room._id.toString(), room.roomNumber]));
  return <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Resident support</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Maintenance tickets</h1><div className="mt-6 flex flex-wrap gap-2">{statuses.map(([key, label]) => <Link key={key || "all"} href={key ? `/owner/tickets?status=${key}` : "/owner/tickets"} aria-current={(status ?? "") === key ? "page" : undefined} className={`min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold ${(status ?? "") === key ? "border-primary bg-primary text-white" : "bg-white"}`}>{label}</Link>)}</div>{tickets.length ? <div className="mt-5 grid gap-3">{tickets.map((ticket) => { const tenant = tenantMap.get(ticket.tenantId.toString()); return <Link key={ticket._id.toString()} href={`/owner/tickets/${ticket._id.toString()}`} className="rounded-2xl border bg-white p-5 hover:border-primary"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{ticket.title}</h2><p className="text-foreground/55 mt-1 text-sm">{tenant?.name ?? "Resident"} · Room {tenant ? roomMap.get(tenant.roomId.toString()) ?? "—" : "—"} · {ticket.category.toLowerCase()}</p><p className="text-foreground/45 mt-1 text-xs">Updated {ticket.updatedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold">{labels[ticket.status] ?? ticket.status}</span></div></Link>; })}</div> : <p className="mt-5 rounded-2xl border bg-white p-6 text-sm text-foreground/60">No tickets in this view.</p>}</main>;
}
