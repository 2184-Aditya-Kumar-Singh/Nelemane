"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TenantDetailData = {
  id: string; name: string; email: string; phone: string; status: "ACTIVE" | "VACATED";
  joinedAt: string; vacatedAt: string | null; monthlyRentPaise: number; depositPaise: number;
  parents: { fatherName: string; motherName?: string; phone: string; alternatePhone?: string };
  profilePhotoUrl: string; hasAadhaar: boolean;
  room: { roomNumber: string; floor: string; block: string; capacity: number; type: string; sharing: number; ac: boolean; attachedBath: boolean } | null;
};
type ApiError = { error?: { message?: string } };
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export function TenantDetail({ tenantId }: { tenantId: string }) {
  const [tenant, setTenant] = useState<TenantDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aadhaarLink, setAadhaarLink] = useState("");
  const [aadhaarBusy, setAadhaarBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/owner/tenants/${tenantId}`, { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { tenant?: TenantDetailData } & ApiError;
      if (!response.ok || !result.tenant) throw new Error(result.error?.message ?? "Tenant details could not be loaded");
      if (active) setTenant(result.tenant);
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Tenant details could not be loaded"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId]);

  async function requestAadhaar() {
    setAadhaarBusy(true); setError(""); setAadhaarLink("");
    try {
      const response = await fetch(`/api/owner/tenants/${tenantId}/aadhaar`, { cache: "no-store" });
      const result = await response.json() as { previewUrl?: string } & ApiError;
      if (!response.ok || !result.previewUrl) throw new Error(result.error?.message ?? "Aadhaar image could not be opened");
      setAadhaarLink(result.previewUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Aadhaar image could not be opened"); }
    finally { setAadhaarBusy(false); }
  }

  if (loading) return <p role="status" className="rounded-2xl border bg-white p-6 text-sm text-foreground/60">Loading tenant…</p>;
  if (!tenant) return <section className="rounded-2xl border bg-white p-6"><p role="alert" className="text-sm text-red-700">{error || "Tenant was not found"}</p><Link href="/owner/tenants" className="text-primary mt-4 inline-block text-sm font-semibold underline">Back to tenants</Link></section>;

  return (
    <div className="grid gap-6">
      <Link href="/owner/tenants" className="text-primary text-sm font-semibold hover:underline">← All tenants</Link>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <section className="flex flex-col gap-5 rounded-2xl border bg-white p-6 sm:flex-row sm:items-center sm:p-8">
        {tenant.profilePhotoUrl ? <span role="img" aria-label={`${tenant.name} profile photo`} className="size-24 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url("${tenant.profilePhotoUrl}")` }} /> : <span aria-hidden="true" className="grid size-24 shrink-0 place-items-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">{tenant.name.slice(0, 1).toUpperCase()}</span>}
        <div><p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">Tenant profile</p><h1 className="font-display text-primary mt-1 text-3xl">{tenant.name}</h1><p className="mt-2 text-sm text-foreground/60">{tenant.email} · {tenant.phone}</p><span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${tenant.status === "ACTIVE" ? "bg-green-100 text-green-900" : "bg-muted text-foreground/60"}`}>{tenant.status === "ACTIVE" ? "Active resident" : "Vacated"}</span></div>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6"><h2 className="font-display text-primary text-xl">Room and rent</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs text-foreground/50">Room</dt><dd className="mt-1 font-semibold">{tenant.room ? `${tenant.room.block ? `${tenant.room.block} · ` : ""}${tenant.room.roomNumber} · ${tenant.room.floor}` : "No room assigned"}</dd></div><div><dt className="text-xs text-foreground/50">Room type</dt><dd className="mt-1 font-semibold">{tenant.room?.type ?? "—"}{tenant.room && ` · ${tenant.room.sharing} sharing · ${tenant.room.ac ? "AC" : "Non-AC"} · ${tenant.room.attachedBath ? "attached bath" : "shared bath"}`}</dd></div><div><dt className="text-xs text-foreground/50">Monthly rent</dt><dd className="mt-1 font-semibold">{money(tenant.monthlyRentPaise)}</dd></div><div><dt className="text-xs text-foreground/50">Deposit</dt><dd className="mt-1 font-semibold">{money(tenant.depositPaise)}</dd></div><div><dt className="text-xs text-foreground/50">Join date</dt><dd className="mt-1 font-semibold">{new Date(tenant.joinedAt).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "UTC" })}</dd></div>{tenant.vacatedAt && <div><dt className="text-xs text-foreground/50">Vacated</dt><dd className="mt-1 font-semibold">{new Date(tenant.vacatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</dd></div>}</dl></section>
        <section className="rounded-2xl border bg-white p-6"><h2 className="font-display text-primary text-xl">Parents / guardian</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs text-foreground/50">Father / guardian</dt><dd className="mt-1 font-semibold">{tenant.parents.fatherName}</dd></div>{tenant.parents.motherName && <div><dt className="text-xs text-foreground/50">Mother</dt><dd className="mt-1 font-semibold">{tenant.parents.motherName}</dd></div>}<div><dt className="text-xs text-foreground/50">Primary contact</dt><dd className="mt-1 font-semibold">{tenant.parents.phone}</dd></div>{tenant.parents.alternatePhone && <div><dt className="text-xs text-foreground/50">Alternate contact</dt><dd className="mt-1 font-semibold">{tenant.parents.alternatePhone}</dd></div>}</dl></section>
      </div>
      <section className="rounded-2xl border bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-primary text-xl">Aadhaar document</h2><p className="mt-1 text-sm text-foreground/55">{tenant.hasAadhaar ? "Private document. Opening it is audit-logged; the signed link expires in 60 seconds." : "No Aadhaar image is stored for this tenant."}</p></div>{tenant.hasAadhaar && <button type="button" disabled={aadhaarBusy} onClick={() => { void requestAadhaar(); }} className="min-h-11 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50">{aadhaarBusy ? "Preparing secure link…" : "View Aadhaar"}</button>}</div>{aadhaarLink && <a href={aadhaarLink} target="_blank" rel="noreferrer" className="text-primary mt-4 inline-block text-sm font-semibold underline">Open private image in a new tab (expires in 60 seconds)</a>}</section>
      <section className="rounded-2xl border border-dashed bg-white/60 p-6"><h2 className="font-display text-primary text-xl">Payment history and tickets</h2><p className="mt-2 text-sm text-foreground/55">These sections will appear here when the rent and ticket phases are completed.</p></section>
    </div>
  );
}
