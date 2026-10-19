import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";

import { AuthorizationError } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { connectToDatabase } from "@/server/db/connection";
import { TicketModel } from "@/server/db/models/ticket";
import { TicketFeedback } from "../../tenant/tickets/[ticketId]/ticket-feedback";

export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" as const };

export default async function TicketApprovalPage({ params, searchParams }: { params: Promise<{ ticketId: string }>; searchParams: Promise<{ token?: string }> }) {
  const { ticketId } = await params;
  const { token } = await searchParams;
  let scoped: Awaited<ReturnType<typeof requireActiveTenant>>;
  try { scoped = await requireActiveTenant(); }
  catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      const path = `/ticket-approval/${ticketId}${token ? `?${new URLSearchParams({ token }).toString()}` : ""}`;
      redirect(`/login?${new URLSearchParams({ callbackUrl: path }).toString()}`);
    }
    if (error instanceof AuthorizationError) redirect("/dashboard?denied=1");
    throw error;
  }
  if (!Types.ObjectId.isValid(ticketId)) notFound();
  await connectToDatabase();
  const ticket = await TicketModel.findOne({ _id: ticketId, tenantId: scoped.tenant._id, pgId: scoped.pgId }).lean();
  if (!ticket) notFound();
  const proofImages = (ticket.resolution?.images ?? []).map((_, index) => `/api/tenant/tickets/${ticket._id.toString()}/image?group=resolution&index=${index}`);
  return <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Repair approval</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Review the repair</h1><section className="mt-6 rounded-2xl border bg-white p-6"><h2 className="font-display text-primary text-2xl">{ticket.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{ticket.resolution?.note ?? "The owner has not added a resolution note."}</p>{proofImages.length > 0 && <div className="mt-4 flex flex-wrap gap-3">{proofImages.map((url, index) => <a key={`${index}-${url}`} href={url} target="_blank" rel="noreferrer" className="size-24 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url("${url}")` }} aria-label={`Open repair proof photo ${index + 1}`} />)}</div>}</section>{ticket.status === "RESOLVED_AWAITING_APPROVAL" ? <TicketFeedback ticketId={ticketId} token={token} /> : <p className="mt-5 rounded-xl border bg-white p-4 text-sm">This ticket is currently {ticket.status.toLowerCase().replaceAll("_", " ")}.</p>}</main>;
}
