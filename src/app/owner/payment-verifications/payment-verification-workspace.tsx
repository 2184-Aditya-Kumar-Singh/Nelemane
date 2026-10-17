"use client";

import { useCallback, useEffect, useState } from "react";

type Payment = {
  id: string; month: string; status: string; mode: string; transactionId: string; transactionDate: string;
  amountSubmittedPaise: number; approvedAmountPaise: number | null; dueAmountPaise: number;
  payerName: string; note: string; rejectionReason: string; createdAt: string; hasScreenshot: boolean;
  duplicateTransaction: boolean; transactionMonthOlderThanCharge: boolean; payerDiffersFromTenant: boolean;
  tenant: { name: string; email: string; phone: string };
  room: { number: string; floor: string; block: string; type: string } | null;
};
type ApiError = { error?: { message?: string } };
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
const date = (value: string) => new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
const dateKey = (value: string) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));

export function PaymentVerificationWorkspace() {
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (nextStatus = status) => {
    const response = await fetch(`/api/owner/payments?status=${nextStatus}`, { cache: "no-store" });
    const result = await response.json() as { payments?: Payment[] } & ApiError;
    if (!response.ok || !result.payments) throw new Error(result.error?.message ?? "Payments could not be loaded");
    setPayments(result.payments);
  }, [status]);
  useEffect(() => {
    let active = true;
    void fetch(`/api/owner/payments?status=${status}`, { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { payments?: Payment[] } & ApiError;
      if (!response.ok || !result.payments) throw new Error(result.error?.message ?? "Payments could not be loaded");
      if (active) setPayments(result.payments);
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Payments could not be loaded"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status]);

  async function approve(payment: Payment) {
    const input = window.prompt("Approved amount in rupees", ((payment.amountSubmittedPaise ?? payment.dueAmountPaise) / 100).toFixed(2));
    if (input === null) return;
    const amountPaise = Math.round(Number(input) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise < 1) { setError("Enter a valid approved amount in rupees."); return; }
    if (!window.confirm(`Approve ${money(amountPaise)} for ${payment.tenant.name} · ${payment.month}?`)) return;
    setBusyId(payment.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/owner/payments/${payment.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvedAmountPaise: amountPaise }) });
      const result = await response.json() as ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "Payment could not be approved");
      await refresh("PENDING"); setNotice("Payment approved. The rent balance and receipt have been updated.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Payment could not be approved"); }
    finally { setBusyId(""); }
  }

  async function reject(payment: Payment) {
    const reason = window.prompt("Enter a reason the tenant can use to correct this payment:");
    if (reason === null) return;
    if (reason.trim().length < 5) { setError("Please provide a rejection reason of at least five characters."); return; }
    if (!window.confirm(`Reject the payment from ${payment.tenant.name}?`)) return;
    setBusyId(payment.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/owner/payments/${payment.id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const result = await response.json() as ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "Payment could not be rejected");
      await refresh("PENDING"); setNotice("Payment rejected. The tenant can review the reason and resubmit.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Payment could not be rejected"); }
    finally { setBusyId(""); }
  }

  async function openProof(payment: Payment) {
    setError("");
    try {
      const response = await fetch(`/api/owner/payments/${payment.id}/screenshot`, { cache: "no-store" });
      const result = await response.json() as { signedUrl?: string } & ApiError;
      if (!response.ok || !result.signedUrl) throw new Error(result.error?.message ?? "Screenshot could not be opened");
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Screenshot could not be opened"); }
  }

  const visible = payments.filter((payment) => {
    const haystack = [payment.tenant.name, payment.tenant.email, payment.room?.number, payment.month, payment.transactionId].join(" ").toLowerCase();
    const day = dateKey(payment.transactionDate);
    return (!search || haystack.includes(search.toLowerCase())) && (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  });
  return <div className="grid gap-5">
    {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border p-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-900"}`}>{error || notice}</p>}
    <div className="flex flex-col gap-4 rounded-2xl border bg-white p-5"><div className="flex flex-wrap gap-2">{(["PENDING", "APPROVED", "REJECTED"] as const).map((item) => <button key={item} type="button" onClick={() => { setLoading(true); setStatus(item); setError(""); }} className={`min-h-10 rounded-lg px-4 text-xs font-bold ${status === item ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}>{item.replaceAll("_", " ")}</button>)}</div><div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"><label className="text-xs font-semibold">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tenant, room, month or transaction ID" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 min-h-10 rounded-lg border bg-background px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 min-h-10 rounded-lg border bg-background px-3 text-sm font-normal" /></label></div></div>
    {loading ? <p role="status" className="rounded-2xl border bg-white p-6 text-sm text-foreground/60">Loading payment verifications…</p> : visible.length ? <div className="grid gap-4">{visible.map((payment) => <article key={payment.id} className="rounded-2xl border bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-primary text-2xl">{payment.tenant.name}</h2><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-950">{payment.status}</span></div><p className="mt-1 text-sm text-foreground/55">{payment.tenant.email} · {payment.tenant.phone} · Room {payment.room?.number ?? "—"}{payment.room?.type ? ` · ${payment.room.type}` : ""}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["Rent month", payment.month], ["Transaction ID", payment.transactionId || "—"], ["Transaction date", date(payment.transactionDate)], ["Submitted amount", money(payment.amountSubmittedPaise)], ["Current due", money(payment.dueAmountPaise)], ["Payer name", payment.payerName], ["Method", payment.mode.replaceAll("_", " ")], ["Submitted", date(payment.createdAt)]].map(([label, value]) => <div key={label}><p className="text-[11px] uppercase tracking-wide text-foreground/45">{label}</p><p className="mt-1 break-all text-sm font-semibold">{value}</p></div>)}</div>{payment.note && <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">Tenant note: {payment.note}</p>}
      {(payment.amountSubmittedPaise !== payment.dueAmountPaise || payment.transactionMonthOlderThanCharge || payment.duplicateTransaction || payment.payerDiffersFromTenant) && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-950">Review warnings</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-950">{payment.amountSubmittedPaise !== payment.dueAmountPaise && <li>Submitted amount differs from the current rent due.</li>}{payment.transactionMonthOlderThanCharge && <li>Transaction date is earlier than the rent month.</li>}{payment.duplicateTransaction && <li>Another payment record uses this transaction ID.</li>}{payment.payerDiffersFromTenant && <li>Payer name differs from the tenant’s account name.</li>}</ul></div>}
      </div><div className="flex shrink-0 flex-wrap gap-2">{payment.hasScreenshot && <button type="button" onClick={() => { void openProof(payment); }} className="min-h-10 rounded-lg border px-3 text-xs font-semibold">View private screenshot</button>}</div></div>{payment.status === "PENDING" && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" disabled={busyId === payment.id} onClick={() => { void reject(payment); }} className="min-h-10 rounded-lg border border-red-200 px-4 text-xs font-semibold text-red-700 disabled:opacity-50">Reject</button><button type="button" disabled={busyId === payment.id} onClick={() => { void approve(payment); }} className="min-h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busyId === payment.id ? "Saving…" : "Approve payment"}</button></div>}</article>)}</div> : <section className="rounded-2xl border bg-white p-8 text-center"><h2 className="font-display text-primary text-2xl">No {status.toLowerCase()} payments</h2><p className="mt-2 text-sm text-foreground/55">Tenant payment submissions will appear here when they register a transfer.</p></section>}
  </div>;
}
