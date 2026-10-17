"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Charge = { id: string; month: string; amountPaise: number; paidAmountPaise: number; dueAmountPaise: number; status: string; windowStart: string; windowEnd: string };
type Payment = { id: string; chargeId: string; month: string; source: string; mode: string; transactionId: string; transactionDate: string; amountSubmittedPaise: number; approvedAmountPaise: number | null; payerName: string; note: string; status: string; rejectionReason: string; hasScreenshot: boolean; createdAt: string };
type ApiError = { error?: { message?: string } };
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
const date = (value: string) => new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

function Status({ status }: { status: string }) {
  const style = status === "PAID" || status === "APPROVED" ? "bg-green-100 text-green-900" : status === "OVERDUE" || status === "REJECTED" ? "bg-red-100 text-red-900" : status === "PENDING_VERIFICATION" || status === "PENDING" ? "bg-amber-100 text-amber-950" : "bg-muted text-foreground/65";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{status.replaceAll("_", " ")}</span>;
}

export function TenantRentWorkspace() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/tenant/payments", { cache: "no-store" });
    const result = await response.json() as { charges?: Charge[]; payments?: Payment[] } & ApiError;
    if (!response.ok || !result.charges || !result.payments) throw new Error(result.error?.message ?? "Rent account could not be loaded");
    setCharges(result.charges);
    setPayments(result.payments);
  }, []);
  useEffect(() => {
    let active = true;
    void fetch("/api/tenant/payments", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { charges?: Charge[]; payments?: Payment[] } & ApiError;
      if (!response.ok || !result.charges || !result.payments) throw new Error(result.error?.message ?? "Rent account could not be loaded");
      if (active) { setCharges(result.charges); setPayments(result.payments); }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Rent account could not be loaded"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function cancel(payment: Payment) {
    if (!window.confirm("Cancel this pending payment submission? You can submit corrected details afterward.")) return;
    setBusyId(payment.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/tenant/payments/${payment.id}`, { method: "DELETE" });
      const result = await response.json() as ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "Payment could not be cancelled");
      await refresh(); setNotice("Pending submission cancelled. You can register a corrected payment now.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Payment could not be cancelled"); }
    finally { setBusyId(""); }
  }

  if (loading) return <p role="status" className="rounded-2xl border bg-white p-6 text-sm text-foreground/60">Loading your rent account…</p>;
  const pendingChargeIds = new Set(payments.filter((payment) => payment.status === "PENDING").map((payment) => payment.chargeId));
  return <div className="grid gap-7">
    {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border p-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-900"}`}>{error || notice}</p>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{charges.map((charge) => <article key={charge.id} className="border-border rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-foreground/45">{charge.month}</p><h2 className="font-display text-primary mt-2 text-2xl">{money(charge.dueAmountPaise)}</h2><p className="mt-1 text-xs text-foreground/55">Due · {date(charge.windowEnd)}</p></div><Status status={charge.status} /></div>
      <p className="mt-4 text-xs text-foreground/55">Monthly charge {money(charge.amountPaise)} · paid {money(charge.paidAmountPaise)}</p>
      <div className="mt-4 flex flex-wrap gap-2">{charge.dueAmountPaise > 0 && <Link href={`/tenant/rent/${charge.id}`} className="bg-primary text-primary-foreground inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">{pendingChargeIds.has(charge.id) ? "Review submission" : "Pay rent"}</Link>}<Link href={`/tenant/rent/${charge.id}`} className="border-border inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-semibold">Payment details</Link></div>
    </article>)}</section>
    {!charges.length && <section className="rounded-2xl border bg-white p-8 text-center"><h2 className="font-display text-primary text-2xl">No rent charges yet</h2><p className="mt-2 text-sm text-foreground/55">Your monthly rent charge will appear here when your PG opens its rent window.</p></section>}
    <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="font-display text-primary text-2xl">Payment history</h2><p className="mt-1 text-sm text-foreground/55">Receipts and submissions stay here for your records.</p></div>
      {payments.length ? <div className="divide-y">{payments.map((payment) => <article key={payment.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{payment.month} · {money(payment.approvedAmountPaise ?? payment.amountSubmittedPaise)}</h3><Status status={payment.status} /></div><p className="mt-1 text-xs text-foreground/55">{payment.source === "OWNER" ? "Recorded by PG" : `Submitted ${date(payment.createdAt)}`} · {payment.mode.replaceAll("_", " ")}{payment.transactionId ? ` · ${payment.transactionId}` : ""}</p>{payment.status === "REJECTED" && <p className="mt-2 text-sm text-red-800">Reason: {payment.rejectionReason || "Please contact your PG owner."}</p>}</div><div className="flex gap-2">{payment.status === "APPROVED" && <Link href={`/tenant/receipts/${payment.id}`} className="inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-semibold">Receipt</Link>}{payment.status === "PENDING" && <button type="button" disabled={busyId === payment.id} onClick={() => { void cancel(payment); }} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 disabled:opacity-50">{busyId === payment.id ? "Cancelling…" : "Cancel submission"}</button>}{payment.hasScreenshot && <button type="button" onClick={async () => { const response = await fetch(`/api/tenant/payments/${payment.id}/screenshot`); const result = await response.json() as { signedUrl?: string }; if (response.ok && result.signedUrl) window.open(result.signedUrl, "_blank", "noopener,noreferrer"); }} className="min-h-10 rounded-lg border px-3 text-xs font-semibold">Screenshot</button>}</div></article>)}</div> : <p className="p-5 text-sm text-foreground/55">No payments have been submitted yet.</p>}
    </section>
  </div>;
}
