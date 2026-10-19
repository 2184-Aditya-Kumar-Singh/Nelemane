"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface PgListItem {
  id: string;
  name: string;
  slug: string;
  owner: { name: string; email: string; phone: string };
  locality: string;
  pincode: string;
  subscription: { status: "ACTIVE" | "SUSPENDED" | "CANCELLED"; planLabel: string; startsAt: Date; endsAt: Date };
  isListed: boolean;
  status: "ACTIVE" | "DELETED";
  deletedAt: Date | null;
  createdAt: Date;
}

export function PgList({ pgs }: { pgs: PgListItem[] }) {
  if (!pgs.length) {
    return <p className="text-foreground/55 mt-5 rounded-2xl border border-dashed p-10 text-center text-sm">No PGs match these filters. Register a PG or change the search.</p>;
  }
  return (
    <section aria-label="PG results" className="mt-5 grid gap-4">
      {pgs.map((pg) => <PgRow key={pg.id} pg={pg} />)}
    </section>
  );
}

function PgRow({ pg }: { pg: PgListItem }) {
  const router = useRouter();
  const [subscriptionStatus, setSubscriptionStatus] = useState(pg.subscription.status);
  const [showDelete, setShowDelete] = useState(false);
  const [nameConfirmation, setNameConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const canPurge = pg.status === "DELETED";

  async function changeSubscription() {
    const status = subscriptionStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (!window.confirm(`${status === "SUSPENDED" ? "Suspend" : "Reactivate"} the subscription for ${pg.name}?`)) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/pgs/${pg.id}/subscription`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json() as { status?: "ACTIVE" | "SUSPENDED"; error?: { message?: string } };
      if (!response.ok || body.status !== status) throw new Error(body.error?.message ?? "Subscription could not be changed");
      setSubscriptionStatus(body.status);
      setNotice(status === "SUSPENDED"
        ? "Subscription suspended. This PG is hidden from public discovery."
        : `Subscription reactivated. Public listing remains ${pg.isListed ? "enabled" : "hidden"}.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Subscription could not be changed");
    } finally {
      setWorking(false);
    }
  }

  async function softDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/pgs/${pg.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmName: nameConfirmation, reason }),
      });
      const body = await response.json() as { error?: { message?: string }; notifications?: { email: string; sms: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "PG could not be deleted");
      setShowDelete(false);
      setNotice(`PG removed. Owner email: ${body.notifications?.email ?? "unknown"}; SMS: ${body.notifications?.sms ?? "unknown"}.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PG could not be deleted");
    } finally {
      setWorking(false);
    }
  }

  async function purge() {
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/admin/pgs/purge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: purgeConfirmation }),
      });
      const body = await response.json() as { error?: { message?: string }; purged?: number; failures?: string[] };
      if (!response.ok) throw new Error(body.error?.message ?? "Purge could not be completed");
      setPurgeConfirmation("");
      setNotice(`${body.purged ?? 0} eligible PG record(s) permanently purged. ${body.failures?.length ?? 0} item(s) need retry.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Purge could not be completed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <article className="border-border rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-primary text-2xl font-medium">{pg.name}</h2><StatusBadge value={pg.status} /><StatusBadge value={subscriptionStatus} /></div>
          <p className="text-foreground/60 mt-2 text-sm">{pg.locality}, Bengaluru · PIN {pg.pincode}</p>
          <p className="mt-3 text-sm font-semibold">{pg.owner.name} <span className="text-foreground/50 font-normal">· {pg.owner.email} · {pg.owner.phone}</span></p>
          <p className="text-foreground/50 mt-1 text-xs">{pg.subscription.planLabel} · ends {new Date(pg.subscription.endsAt).toLocaleDateString("en-IN")}{subscriptionStatus === "ACTIVE" && pg.isListed ? " · Public listing enabled" : " · Hidden from public listings"}</p>
          {notice && <p role="status" className="text-success mt-3 text-sm">{notice}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/pgs/${pg.id}`} className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold hover:bg-muted">View / edit</Link>
          {pg.status === "ACTIVE" && subscriptionStatus !== "CANCELLED" && <button type="button" disabled={working} onClick={changeSubscription} className="min-h-10 rounded-lg border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50">{working ? subscriptionStatus === "ACTIVE" ? "Suspending…" : "Reactivating…" : subscriptionStatus === "ACTIVE" ? "Suspend" : "Reactivate"}</button>}
          {pg.status === "ACTIVE" && <button type="button" disabled={working} onClick={() => { setError(""); setShowDelete(true); }} className="min-h-10 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>}
          {canPurge && <button type="button" disabled={working} onClick={() => { setError(""); setPurgeConfirmation(" "); }} className="min-h-10 rounded-lg bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">Purge eligible</button>}
        </div>
      </div>

      {showDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-primary/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby={`delete-title-${pg.id}`} className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl">
            <h3 id={`delete-title-${pg.id}`} className="font-display text-2xl">Remove {pg.name}?</h3>
            <p className="text-foreground/60 mt-2 text-sm">This hides the PG, cancels its subscription and disables all associated logins. The record and images remain recoverable for 30 days. The owner receives the reason by email and SMS when configured.</p>
            <form onSubmit={softDelete} className="mt-5 grid gap-4">
              <label className="text-sm font-semibold">Type the PG name: {pg.name}<input required value={nameConfirmation} onChange={(event) => setNameConfirmation(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal" /></label>
              <label className="text-sm font-semibold">Reason for removal<textarea required minLength={5} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal" /></label>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowDelete(false)} className="min-h-10 rounded-lg border px-4 text-sm font-semibold">Cancel</button><button disabled={working} className="min-h-10 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{working ? "Removing…" : "Remove PG"}</button></div>
            </form>
          </section>
        </div>
      )}

      {purgeConfirmation !== "" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-primary/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby={`purge-title-${pg.id}`} className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl">
            <h3 id={`purge-title-${pg.id}`} className="font-display text-2xl">Permanently purge old records?</h3>
            <p className="text-foreground/60 mt-2 text-sm">This purges up to 20 PG records deleted at least 30 days ago and permanently removes their stored images. Audit history is retained.</p>
            <label className="mt-4 block text-sm font-semibold">Type PURGE to continue<input autoFocus value={purgeConfirmation.trimStart()} onChange={(event) => setPurgeConfirmation(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal" /></label>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPurgeConfirmation("")} className="min-h-10 rounded-lg border px-4 text-sm font-semibold">Cancel</button><button type="button" disabled={working || purgeConfirmation.trim() !== "PURGE"} onClick={purge} className="min-h-10 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{working ? "Purging…" : "Purge records"}</button></div>
          </section>
        </div>
      )}
    </article>
  );
}

function StatusBadge({ value }: { value: string }) {
  const active = value === "ACTIVE";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${active ? "bg-green-100 text-green-800" : value === "DELETED" || value === "CANCELLED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{value}</span>;
}
