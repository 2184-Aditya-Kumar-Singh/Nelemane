"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TicketSummary = { id: string; title: string; category: string; priority: string; status: string; createdAt: string; updatedAt: string };
type Upload = { id: string; previewUrl: string };
const categories = ["ELECTRICAL", "PLUMBING", "WIFI", "CLEANING", "FOOD", "FURNITURE", "OTHER"];
const statusLabels: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED_AWAITING_APPROVAL: "Needs your approval", CLOSED: "Closed", REOPENED: "Reopened" };

export function TicketWorkspace() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [files, setFiles] = useState<Upload[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    const response = await fetch("/api/tenant/tickets");
    const data = await response.json() as { tickets?: TicketSummary[] };
    if (response.ok) setTickets(data.tickets ?? []);
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/tenant/tickets").then(async (response) => {
      const data = await response.json() as { tickets?: TicketSummary[] };
      if (!response.ok) throw new Error("Ticket history could not be loaded");
      if (active) setTickets(data.tickets ?? []);
    }).catch(() => { if (active) setMessage("Ticket history could not be loaded"); });
    return () => { active = false; };
  }, []);

  async function uploadFiles(selected: FileList | null) {
    if (!selected?.length) return;
    if (files.length + selected.length > 5) { setMessage("Add up to 5 photos per ticket."); return; }
    setBusy(true); setMessage("");
    try {
      const next: Upload[] = [];
      for (const file of Array.from(selected)) {
        const form = new FormData(); form.set("purpose", "TICKET_IMAGE"); form.set("file", file);
        const response = await fetch("/api/tenant/uploads", { method: "POST", body: form });
        const data = await response.json() as { asset?: { id: string; previewUrl: string }; error?: { message?: string } };
        if (!response.ok || !data.asset) throw new Error(data.error?.message ?? "Photo upload failed");
        next.push({ id: data.asset.id, previewUrl: data.asset.previewUrl });
      }
      setFiles((current) => [...current, ...next]);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Photo upload failed"); }
    finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/tenant/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description, category, imageAssetIds: files.map((file) => file.id) }) });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Ticket could not be created");
      setTitle(""); setDescription(""); setCategory("OTHER"); setFiles([]); setMessage("Ticket sent to your PG owner."); await refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Ticket could not be created"); }
    finally { setBusy(false); }
  }

  return <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
    <section className="h-fit rounded-2xl border bg-white p-5 sm:p-6"><h2 className="font-display text-primary text-2xl">Report an issue</h2><p className="text-foreground/60 mt-2 text-sm">Add a clear description and up to five photos.</p><form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}><label className="block text-sm font-semibold">Title<input required minLength={4} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="block text-sm font-semibold">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 font-normal">{categories.map((value) => <option key={value} value={value}>{value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())}</option>)}</select></label><label className="block text-sm font-semibold">What happened?<textarea required minLength={10} maxLength={5000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label><label className="block text-sm font-semibold">Photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || files.length >= 5} onChange={(event) => { void uploadFiles(event.target.files); event.currentTarget.value = ""; }} className="mt-2 block w-full text-xs file:min-h-10 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:text-white" /></label>{files.length > 0 && <div className="flex flex-wrap gap-2">{files.map((file, index) => <div key={file.id} className="relative"><div role="img" aria-label={`Issue photo ${index + 1} preview`} className="size-16 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${file.previewUrl}")` }} /><button type="button" onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))} aria-label={`Remove photo ${index + 1}`} className="absolute -right-1 -top-1 size-6 rounded-full bg-white text-xs shadow">×</button></div>)}</div>}<button disabled={busy} className="bg-primary text-primary-foreground min-h-11 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-60">{busy ? "Please wait…" : "Submit ticket"}</button>{message && <p role="status" className="text-sm">{message}</p>}</form></section>
    <section><h2 className="font-display text-primary text-2xl">Your tickets</h2>{tickets.length ? <div className="mt-4 space-y-3">{tickets.map((ticket) => <Link key={ticket.id} href={`/tenant/tickets/${ticket.id}`} className="block rounded-2xl border bg-white p-5 hover:border-primary"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{ticket.title}</h3><p className="text-foreground/55 mt-1 text-xs">{ticket.category.toLowerCase()} · Updated {new Date(ticket.updatedAt).toLocaleDateString("en-IN")}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold">{statusLabels[ticket.status] ?? ticket.status}</span></div></Link>)}</div> : <p className="mt-4 rounded-2xl border bg-white p-5 text-sm text-foreground/60">No maintenance tickets yet.</p>}</section>
  </div>;
}
