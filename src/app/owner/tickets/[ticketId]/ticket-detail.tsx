"use client";

import { useEffect, useState } from "react";

type Ticket = { id: string; title: string; description: string; category: string; priority: string; status: string; createdAt: string; images: string[]; resolution: { note: string; resolvedAt: string; images: string[] } | null; feedback: { approved: boolean; comment: string; at: string } | null; timeline: Array<{ at: string; action: string; note: string }>; tenant: { name: string; email: string; phone: string; room: string } | null };
type Upload = { id: string; previewUrl: string };
const labels: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED_AWAITING_APPROVAL: "Awaiting tenant approval", CLOSED: "Closed", REOPENED: "Reopened" };

export function OwnerTicketDetail({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    const response = await fetch(`/api/owner/tickets/${ticketId}`);
    const data = await response.json() as { ticket?: Ticket; error?: { message?: string } };
    if (!response.ok || !data.ticket) throw new Error(data.error?.message ?? "Ticket could not be loaded");
    setTicket(data.ticket);
  }
  useEffect(() => {
    let active = true;
    void fetch(`/api/owner/tickets/${ticketId}`).then(async (response) => {
      const data = await response.json() as { ticket?: Ticket; error?: { message?: string } };
      if (!response.ok || !data.ticket) throw new Error(data.error?.message ?? "Ticket could not be loaded");
      if (active) setTicket(data.ticket);
    }).catch((cause: unknown) => { if (active) setMessage(cause instanceof Error ? cause.message : "Ticket could not be loaded"); });
    return () => { active = false; };
  }, [ticketId]);
  async function uploadFiles(selected: FileList | null) {
    if (!selected?.length) return;
    if (proof.length + selected.length > 5) { setMessage("Add up to 5 proof photos."); return; }
    setBusy(true); setMessage("");
    try {
      const next: Upload[] = [];
      for (const file of Array.from(selected)) {
        const form = new FormData(); form.set("purpose", "OWNER_TICKET_PROOF"); form.set("file", file);
        const response = await fetch("/api/owner/uploads", { method: "POST", body: form });
        const data = await response.json() as { asset?: { id: string; previewUrl: string }; error?: { message?: string } };
        if (!response.ok || !data.asset) throw new Error(data.error?.message ?? "Proof photo upload failed");
        next.push({ id: data.asset.id, previewUrl: data.asset.previewUrl });
      }
      setProof((current) => [...current, ...next]);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Proof photo upload failed"); }
    finally { setBusy(false); }
  }
  async function update(body: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/owner/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Ticket could not be updated");
      setProof([]); setNote(""); setMessage("Ticket updated."); await refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Ticket could not be updated"); }
    finally { setBusy(false); }
  }
  if (!ticket) return <p className="mt-6 rounded-2xl border bg-white p-6 text-sm">{message || "Loading ticket…"}</p>;
  return <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="space-y-5"><section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-accent text-xs font-bold tracking-widest uppercase">{ticket.category.toLowerCase()} · {ticket.priority.toLowerCase()} priority</p><h2 className="font-display text-primary mt-2 text-3xl">{ticket.title}</h2></div><span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold">{labels[ticket.status] ?? ticket.status}</span></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6">{ticket.description}</p>{ticket.images.length > 0 && <div className="mt-4 flex flex-wrap gap-3">{ticket.images.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="size-24 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url("${url}")` }} aria-label={`Open tenant photo ${index + 1}`} />)}</div>}</section>
    {ticket.resolution && <section className="rounded-2xl border bg-white p-5"><h3 className="font-display text-primary text-2xl">Resolution sent</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{ticket.resolution.note}</p><div className="mt-3 flex flex-wrap gap-3">{ticket.resolution.images.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="size-20 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url("${url}")` }} aria-label={`Open resolution proof ${index + 1}`} />)}</div>{ticket.feedback && <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">Resident {ticket.feedback.approved ? "approved the fix" : "reopened the ticket"}{ticket.feedback.comment ? `: ${ticket.feedback.comment}` : ""}</p>}</section>}
    {ticket.status === "OPEN" || ticket.status === "REOPENED" ? <section className="rounded-2xl border bg-white p-5"><h3 className="font-display text-primary text-xl">Start work</h3><p className="text-foreground/55 mt-1 text-sm">Move the ticket into progress so the resident can follow along.</p><button type="button" disabled={busy} onClick={() => void update({ action: "IN_PROGRESS" })} className="bg-primary text-primary-foreground mt-4 min-h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60">Mark in progress</button></section> : null}
    {ticket.status === "IN_PROGRESS" && <section className="rounded-2xl border bg-white p-5"><h3 className="font-display text-primary text-xl">Mark solved</h3><p className="text-foreground/55 mt-1 text-sm">Describe the repair and attach at least one proof photo.</p><label className="mt-4 block text-sm font-semibold">Resolution note<textarea required minLength={5} maxLength={2000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label><label className="mt-4 block text-sm font-semibold">Proof photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || proof.length >= 5} onChange={(event) => { void uploadFiles(event.target.files); event.currentTarget.value = ""; }} className="mt-2 block w-full text-xs file:min-h-10 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:text-white" /></label>{proof.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{proof.map((item, index) => <div key={item.id} className="relative"><div role="img" aria-label={`Proof ${index + 1} preview`} className="size-16 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${item.previewUrl}")` }} /><button type="button" onClick={() => setProof((current) => current.filter((entry) => entry.id !== item.id))} className="absolute -right-1 -top-1 size-6 rounded-full bg-white text-xs shadow" aria-label={`Remove proof photo ${index + 1}`}>×</button></div>)}</div>}<button type="button" disabled={busy || !note.trim() || proof.length === 0} onClick={() => void update({ action: "RESOLVE", note, imageAssetIds: proof.map((item) => item.id) })} className="bg-primary text-primary-foreground mt-4 min-h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">Send for tenant approval</button></section>}
    {message && <p role="status" className="text-sm">{message}</p>}</div><aside className="h-fit rounded-2xl border bg-white p-5"><h3 className="font-display text-primary text-xl">Resident</h3>{ticket.tenant ? <><p className="mt-3 font-semibold">{ticket.tenant.name}</p><p className="text-foreground/60 mt-1 text-sm">Room {ticket.tenant.room}</p><a href={`tel:${ticket.tenant.phone}`} className="text-primary mt-3 block text-sm underline">{ticket.tenant.phone}</a><a href={`mailto:${ticket.tenant.email}`} className="text-primary mt-1 block break-all text-sm underline">{ticket.tenant.email}</a></> : <p className="text-foreground/55 mt-3 text-sm">Resident details unavailable.</p>}<h3 className="font-display text-primary mt-6 text-xl">Timeline</h3><ol className="mt-3 space-y-4">{ticket.timeline.map((entry, index) => <li key={`${entry.action}-${index}`} className="border-l-2 border-primary/20 pl-3"><p className="text-sm font-semibold">{entry.action.toLowerCase().replaceAll("_", " ")}</p>{entry.note && <p className="text-foreground/60 mt-1 text-xs">{entry.note}</p>}<time className="text-foreground/45 mt-1 block text-[11px]">{new Date(entry.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</time></li>)}</ol></aside></div>;
}
