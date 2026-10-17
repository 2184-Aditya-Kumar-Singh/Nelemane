"use client";

import { useState } from "react";

export function ContactForm({ initialTopic }: { initialTopic: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const topic = initialTopic === "list-pg" ? "LIST_PG" : initialTopic === "support" ? "SUPPORT" : "GENERAL";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), topic: form.get("topic"), message: form.get("message") }) });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Message could not be sent");
      formElement.reset(); setMessage("Thanks — your message has been sent.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Message could not be sent"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4 rounded-2xl border bg-white p-5 sm:p-7 dark:bg-white/[0.04]"><label className="block text-sm font-semibold">Your name<input name="name" autoComplete="name" required minLength={2} maxLength={120} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal" /></label><label className="block text-sm font-semibold">Email address<input name="email" type="email" autoComplete="email" required maxLength={254} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal" /></label><label className="block text-sm font-semibold">Topic<select name="topic" defaultValue={topic} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="LIST_PG">List a PG</option><option value="GENERAL">General question</option><option value="SUPPORT">Account support</option></select></label><label className="block text-sm font-semibold">Message<textarea name="message" required minLength={10} maxLength={3000} rows={6} className="mt-1 w-full rounded-xl border bg-background p-3 font-normal" /></label><button disabled={busy} className="bg-primary text-primary-foreground min-h-11 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-60">{busy ? "Sending…" : "Send message"}</button>{message && <p role="status" className="text-sm">{message}</p>}</form>;
}
