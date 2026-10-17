"use client";

import { useState } from "react";

export function TicketFeedback({ ticketId, token }: { ticketId: string; token?: string }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(approved: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/tenant/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved, comment, token }) });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Your response could not be saved");
      setMessage(approved ? "Thanks. This ticket is now closed." : "Ticket reopened. Your PG owner has been notified.");
      window.location.reload();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Your response could not be saved"); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5"><h2 className="font-display text-primary text-xl">Is the issue fixed?</h2><p className="text-foreground/60 mt-1 text-sm">Review the owner’s note and proof photos before choosing.</p><label className="mt-4 block text-sm font-semibold">Comment{<span className="text-foreground/50 font-normal"> · required if it is not fixed</span>}<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border bg-white p-3 font-normal" /></label><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void submit(true)} className="bg-primary text-primary-foreground min-h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60">Approve and close</button><button type="button" disabled={busy || !comment.trim()} onClick={() => void submit(false)} className="min-h-10 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50">Not fixed · reopen</button></div>{message && <p role="status" className="mt-3 text-sm">{message}</p>}</section>;
}
