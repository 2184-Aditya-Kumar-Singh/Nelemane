import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";

import { AuthorizationError } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { TicketModel } from "@/server/db/models/ticket";
import { signTicketImages } from "@/server/tickets/assets";
import { TicketFeedback } from "./ticket-feedback";

export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" as const };

const labels: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED_AWAITING_APPROVAL: "Needs your approval", CLOSED: "Closed", REOPENED: "Reopened" };

export default async function TenantTicketDetailPage({ params, searchParams }: { params: Promise<{ ticketId: string }>; searchParams: Promise<{ token?: string }> }) {
  const { ticketId } = await params;
  const { token } = await searchParams;
  let scoped: Awaited<ReturnType<typeof requireActiveTenant>>;
  try { scoped = await requireActiveTenant(); }
  catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      const callback = new URLSearchParams({ token: token ?? "" });
      const path = `/tenant/tickets/${ticketId}${token ? `?${callback.toString()}` : ""}`;
      redirect(`/login?${new URLSearchParams({ callbackUrl: path }).toString()}`);
    }
    if (error instanceof AuthorizationError) redirect("/dashboard?denied=1");
    throw error;
  }
  if (!Types.ObjectId.isValid(ticketId)) notFound();
  await connectToDatabase();
  const ticket = await TicketModel.findOne({ _id: ticketId, tenantId: scoped.tenant._id, pgId: scoped.pgId }).lean();
  if (!ticket) notFound();
  const images = await signTicketImages(ticket.images);
  const proofImages = ticket.resolution ? await signTicketImages(ticket.resolution.images) : [];
  if (images.length || proofImages.length) await AuditLogModel.create({ actorId: scoped.user.id, action: "TICKET_IMAGES_VIEWED", entity: "Ticket", entityId: ticket._id, meta: { pgId: scoped.pgId, tenantId: scoped.tenant._id.toString(), imageCount: images.length + proofImages.length } });

  return <main className="mx-auto max-w-4xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Maintenance ticket</p><div className="mt-2 flex flex-wrap items-start justify-between gap-3"><h1 className="font-display text-primary text-4xl font-medium">{ticket.title}</h1><span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold">{labels[ticket.status] ?? ticket.status}</span></div><p className="text-foreground/55 mt-2 text-sm">{ticket.category.toLowerCase()} · Opened {ticket.createdAt.toLocaleDateString("en-IN")}</p><section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Your description</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{ticket.description}</p>{images.length > 0 && <div className="mt-4 flex flex-wrap gap-3">{images.map((url, index) => <a key={`${index}-${url}`} href={url} target="_blank" rel="noreferrer" className="size-24 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url("${url}")` }} aria-label={`Open issue photo ${index + 1}`} />)}</div>}</section>
    {ticket.resolution && <section className="mt-5 rounded-2xl border bg-white p-5"><h2 className="font-display text-primary text-2xl">Owner’s update</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{ticket.resolution.note}</p><div className="mt-3 flex flex-wrap gap-3">{proofImages.map((url, index) => <a key={`${index}-${url}`} href={url} target="_blank" rel="noreferrer" className="size-24 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url("${url}")` }} aria-label={`Open repair proof photo ${index + 1}`} />)}</div></section>}
    <section className="mt-5 rounded-2xl border bg-white p-5"><h2 className="font-display text-primary text-2xl">Ticket history</h2><ol className="mt-4 space-y-4">{ticket.timeline.map((entry, index) => <li key={`${entry.action}-${index}`} className="border-l-2 border-primary/20 pl-4"><p className="text-sm font-semibold">{entry.action.toLowerCase().replaceAll("_", " ")}</p>{entry.note && <p className="text-foreground/65 mt-1 text-sm">{entry.note}</p>}<time className="text-foreground/45 mt-1 block text-xs">{entry.at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</time></li>)}</ol></section>
    {ticket.status === "RESOLVED_AWAITING_APPROVAL" && <TicketFeedback ticketId={ticketId} token={token} />}
  </main>;
}
