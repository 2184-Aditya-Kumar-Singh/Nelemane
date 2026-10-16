"use client";

import { useEffect, useState } from "react";

interface AuditItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown>;
  ip: string | null;
  actor: { name: string; email: string } | null;
  createdAt: string;
}

export function AuditViewer() {
  const [filters, setFilters] = useState({ action: "", entity: "", actorId: "", from: "", to: "" });
  const [applied, setApplied] = useState(filters);
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(applied)) if (value) query.set(key, value);
    void fetch(`/api/admin/audit?${query.toString()}`).then(async (response) => {
      const result = await response.json() as { logs?: AuditItem[]; error?: { message: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Audit history could not be loaded");
      if (active) setLogs(result.logs ?? []);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Audit history could not be loaded");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setApplied(filters);
  }

  return (
    <section className="mt-7">
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
        <Field label="Action" value={filters.action} onChange={(value) => setFilters({ ...filters, action: value })} placeholder="PG_CREATED" />
        <Field label="Entity" value={filters.entity} onChange={(value) => setFilters({ ...filters, entity: value })} placeholder="PG" />
        <Field label="Actor ID" value={filters.actorId} onChange={(value) => setFilters({ ...filters, actorId: value })} placeholder="MongoDB user ID" />
        <Field label="From date" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: value })} />
        <Field label="To date" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: value })} />
        <div className="flex gap-2 sm:col-span-2 xl:col-span-5"><button className="bg-primary text-primary-foreground min-h-10 rounded-lg px-4 text-sm font-semibold">Apply filters</button><button type="button" onClick={() => { const empty = { action: "", entity: "", actorId: "", from: "", to: "" }; setLoading(true); setError(""); setFilters(empty); setApplied(empty); }} className="min-h-10 rounded-lg border px-4 text-sm font-semibold">Clear</button></div>
      </form>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading ? <p className="text-foreground/55 mt-5 rounded-2xl border bg-white p-7 text-sm">Loading audit history…</p> : logs.length ? <div className="mt-5 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-wide"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-border">{logs.map((log) => <tr key={log.id} className="align-top"><td className="whitespace-nowrap px-4 py-3 text-xs text-foreground/60">{new Date(log.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td><td className="px-4 py-3 font-semibold">{log.action}</td><td className="px-4 py-3">{log.actor?.name ?? "System"}<span className="text-foreground/50 block text-xs">{log.actor?.email ?? ""}</span></td><td className="px-4 py-3">{log.entity}<span className="text-foreground/50 block max-w-36 truncate text-xs" title={log.entityId ?? ""}>{log.entityId ?? "—"}</span></td><td className="max-w-lg whitespace-pre-wrap break-words px-4 py-3 text-xs text-foreground/65">{JSON.stringify(log.meta)}</td></tr>)}</tbody></table></div> : <p className="text-foreground/55 mt-5 rounded-2xl border border-dashed bg-white p-10 text-center text-sm">No audit events match these filters.</p>}
    </section>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="text-xs font-semibold">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal" /></label>;
}
