"use client";

import { useEffect, useState } from "react";

interface ReportItem {
  id: string;
  subject: string;
  message: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string;
  fromUser: { id: string; name: string; email: string; role: string } | null;
  pg: { id: string; name: string; slug: string } | null;
  resolvedBy: { name: string; email: string } | null;
}

export function ReportsInbox() {
  const [status, setStatus] = useState<"OPEN" | "RESOLVED">("OPEN");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/reports?status=${status}`).then(async (response) => {
      const result = await response.json() as { reports?: ReportItem[]; error?: { message: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Reports could not be loaded");
      if (active) setReports(result.reports ?? []);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Reports could not be loaded");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status]);

  async function resolve(report: ReportItem) {
    const note = window.prompt("Resolution note (optional):", "");
    if (note === null) return;
    setWorkingId(report.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const result = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Report could not be resolved");
      setReports((items) => items.filter((item) => item.id !== report.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report could not be resolved");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <section className="mt-7">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Report status filter">
        {(["OPEN", "RESOLVED"] as const).map((value) => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setLoading(true); setError(""); setStatus(value); }} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${status === value ? "bg-primary text-white" : "border bg-white hover:bg-muted"}`}>{value === "OPEN" ? "Open" : "Resolved"}</button>)}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading ? <p className="text-foreground/55 mt-5 rounded-2xl border bg-white p-7 text-sm">Loading reports…</p> : reports.length ? <div className="mt-5 grid gap-4">{reports.map((report) => <article key={report.id} className="border-border rounded-2xl border bg-white p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${report.status === "OPEN" ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}`}>{report.status}</span><h2 className="font-display text-primary mt-3 text-2xl font-medium">{report.subject}</h2><p className="text-foreground/55 mt-1 text-sm">{report.pg?.name ?? "Unknown PG"} · {report.fromUser?.name ?? "Unknown sender"} ({report.fromUser?.role ?? "Unknown role"}) · {report.fromUser?.email ?? ""}</p></div><time className="text-foreground/45 text-xs" dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></div><p className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-sm leading-6">{report.message}</p>{report.status === "RESOLVED" && <p className="text-foreground/60 mt-4 text-sm">Resolved by {report.resolvedBy?.name ?? "admin"}{report.resolutionNote ? `: ${report.resolutionNote}` : " without a note"}.</p>}{report.status === "OPEN" && <button type="button" disabled={workingId === report.id} onClick={() => void resolve(report)} className="bg-primary text-primary-foreground mt-4 min-h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-50">{workingId === report.id ? "Saving…" : "Mark resolved"}</button>}</article>)}</div> : <p className="text-foreground/55 mt-5 rounded-2xl border border-dashed bg-white p-10 text-center text-sm">{status === "OPEN" ? "No open reports." : "No resolved reports yet."}</p>}
    </section>
  );
}
