"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Tenant = {
  id: string; name: string; email: string; phone: string; status: "ACTIVE" | "VACATED";
  room: { id: string; roomNumber: string; floor: string; block: string; roomType: { name: string; sharing: number } | null } | null;
  monthlyRentPaise: number; depositPaise: number; joinedAt: string; vacatedAt: string | null;
  profilePhotoUrl: string; hasAadhaar: boolean;
};
type ApiError = { error?: { message?: string } };
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export function TenantWorkspace() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "VACATED">("ACTIVE");
  const [removing, setRemoving] = useState<Tenant | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleteAadhaar, setDeleteAadhaar] = useState(false);
  const [reporting, setReporting] = useState<Tenant | null>(null);
  const [reportSubject, setReportSubject] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/owner/tenants", { cache: "no-store" });
    const result = await response.json() as { tenants?: Tenant[] } & ApiError;
    if (!response.ok || !result.tenants) throw new Error(result.error?.message ?? "Tenant list could not be loaded");
    setTenants(result.tenants);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/owner/tenants", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { tenants?: Tenant[] } & ApiError;
      if (!response.ok || !result.tenants) throw new Error(result.error?.message ?? "Tenant list could not be loaded");
      if (active) setTenants(result.tenants);
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Tenant list could not be loaded"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function vacate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!removing) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/owner/tenants/${removing.id}/remove`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmName, deleteAadhaarNow: deleteAadhaar }) });
      const result = await response.json() as { notifications?: { email: string; sms: string }; imageCleanup?: string } & ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "Tenant could not be removed");
      await refresh();
      const emailMessage = result.notifications?.email === "SENT" ? "Tenant notified by email." : result.notifications?.email === "FAILED" ? "Tenant email notification failed." : "Email delivery is not configured.";
      const smsMessage = result.notifications?.sms === "SENT" ? "SMS sent." : result.notifications?.sms === "FAILED" ? "SMS notification failed." : "SMS was skipped.";
      setNotice(`Tenant marked as vacated and bed freed. ${emailMessage} ${smsMessage}${result.imageCleanup === "PENDING" ? " Aadhaar image cleanup is pending." : ""}`);
      setRemoving(null); setConfirmName(""); setDeleteAadhaar(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tenant could not be removed"); }
    finally { setBusy(false); }
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!reporting) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/owner/tenants/${reporting.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: reportSubject, message: reportMessage }) });
      const result = await response.json() as { notificationStatus?: string } & ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "Admin report could not be sent");
      setNotice(result.notificationStatus === "SENT" ? "Report saved and emailed to the platform admin." : result.notificationStatus === "FAILED" ? "Report saved, but the admin email failed." : "Report saved. Admin email delivery is not configured.");
      setReporting(null); setReportSubject(""); setReportMessage("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Admin report could not be sent"); }
    finally { setBusy(false); }
  }

  if (loading) return <p role="status" className="rounded-2xl border bg-white p-6 text-sm text-foreground/60">Loading tenants…</p>;
  const visible = filter === "ALL" ? tenants : tenants.filter((tenant) => tenant.status === filter);
  const active = tenants.filter((tenant) => tenant.status === "ACTIVE").length;

  return (
    <div className="grid gap-5">
      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border p-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-900"}`}>{error || notice}</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Active residents</p><p className="font-display text-primary mt-1 text-3xl">{active}</p></div><label className="text-sm font-semibold">Show<select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="ml-2 min-h-10 rounded-lg border bg-background px-3 font-normal"><option value="ACTIVE">Active</option><option value="VACATED">Past residents</option><option value="ALL">Everyone</option></select></label></div>
      {visible.length ? <div className="grid gap-3">{visible.map((tenant) => <article key={tenant.id} className="flex flex-col gap-4 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:p-5">
        {tenant.profilePhotoUrl ? <span role="img" aria-label={`${tenant.name} profile photo`} className="size-14 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url("${tenant.profilePhotoUrl}")` }} /> : <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{tenant.name.slice(0,1).toUpperCase()}</span>}
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{tenant.name}</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tenant.status === "ACTIVE" ? "bg-green-100 text-green-900" : "bg-muted text-foreground/60"}`}>{tenant.status === "ACTIVE" ? "Active" : "Vacated"}</span>{tenant.hasAadhaar && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">Aadhaar on file</span>}</div><p className="mt-1 truncate text-sm text-foreground/60">{tenant.email} · {tenant.phone}</p><p className="mt-1 text-xs text-foreground/50">{tenant.room ? `${tenant.room.block ? `${tenant.room.block} · ` : ""}${tenant.room.roomNumber} · ${tenant.room.floor} · ${tenant.room.roomType?.name ?? "Room"}` : "No room assigned"} · {money(tenant.monthlyRentPaise)}/month</p></div>
        <div className="flex flex-wrap gap-2"><Link href={`/owner/tenants/${tenant.id}`} className="inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-semibold">Details</Link><button type="button" onClick={() => { setReporting(tenant); setReportSubject(`Tenant issue: ${tenant.name}`); setReportMessage(""); setError(""); }} className="min-h-10 rounded-lg border px-3 text-xs font-semibold">Report a problem to admin</button>{tenant.status === "ACTIVE" && <button type="button" onClick={() => { setRemoving(tenant); setConfirmName(""); setDeleteAadhaar(false); setError(""); }} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700">Remove tenant</button>}</div>
      </article>)}</div> : <section className="rounded-2xl border bg-white p-8 text-center"><h2 className="font-display text-primary text-2xl">No tenants found</h2><p className="mt-2 text-sm text-foreground/55">Add a resident to a room with a free bed.</p><Link href="/owner/tenants/new" className="bg-primary text-primary-foreground mt-5 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold">Add tenant</Link></section>}

      {removing && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"><section role="dialog" aria-modal="true" aria-labelledby="vacate-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-6 shadow-2xl"><p className="text-xs font-bold uppercase tracking-[0.14em] text-red-700">Move-out</p><h2 id="vacate-title" className="font-display text-primary mt-2 text-2xl">Remove {removing.name}?</h2><p className="mt-2 text-sm leading-6 text-foreground/65">This marks the account as vacated, disables tenant login and frees the room bed. Their payment history will be kept.</p><p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">If something was removed by mistake, report it to the admin.</p><form onSubmit={(event) => { void vacate(event); }} className="mt-5 grid gap-4"><label className="text-sm font-semibold">Type the tenant’s name to confirm<input required value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal" /></label>{removing.hasAadhaar && <label className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={deleteAadhaar} onChange={(e) => setDeleteAadhaar(e.target.checked)} className="mt-0.5 size-4 accent-primary" /><span>Delete the stored Aadhaar image now</span></label>}<div className="flex flex-wrap gap-2"><button disabled={busy || confirmName !== removing.name} className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Removing…" : "Vacate tenant and free bed"}</button><button type="button" onClick={() => { setReporting(removing); setReportSubject(`Tenant issue: ${removing.name}`); setReportMessage(""); setRemoving(null); }} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Report a problem</button><button type="button" onClick={() => setRemoving(null)} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Cancel</button></div></form></section></div>}

      {reporting && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"><section role="dialog" aria-modal="true" aria-labelledby="report-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-6 shadow-2xl"><p className="text-accent text-xs font-bold uppercase tracking-[0.14em]">Platform support</p><h2 id="report-title" className="font-display text-primary mt-2 text-2xl">Report a problem to admin</h2><p className="mt-2 text-sm text-foreground/60">This creates an admin report tied to {reporting.name} and sends a notification to the platform administrator.</p><form onSubmit={(event) => { void submitReport(event); }} className="mt-5 grid gap-4"><label className="text-sm font-semibold">Subject<input required minLength={4} maxLength={180} value={reportSubject} onChange={(e) => setReportSubject(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">What happened?<textarea required minLength={10} maxLength={5000} rows={5} value={reportMessage} onChange={(e) => setReportMessage(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm font-normal" /></label><div className="flex gap-2"><button disabled={busy} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Sending…" : "Send report"}</button><button type="button" onClick={() => setReporting(null)} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Cancel</button></div></form></section></div>}
    </div>
  );
}
