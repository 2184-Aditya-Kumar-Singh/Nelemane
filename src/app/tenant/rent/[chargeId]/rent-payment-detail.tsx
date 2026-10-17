"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Charge = { id: string; month: string; amountPaise: number; paidAmountPaise: number; dueAmountPaise: number; status: string; windowStart: string; windowEnd: string };
type Details = { upiId: string; qrImageUrl: string; bank: { accountHolderName: string; bankName: string; accountNumber: string; ifsc: string; branch: string } | null; instructions: string };
type Payload = { charge?: Charge; pg?: { name: string; ownerPhone: string }; paymentDetails?: Details; pendingPayment?: { id: string; amountPaise: number; createdAt: string } | null; error?: { message?: string } };
type Upload = { assetId: string; previewUrl: string } | null;
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
function todayLocal() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export function RentPaymentDetail({ chargeId }: { chargeId: string }) {
  const [payload, setPayload] = useState<Payload>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [upload, setUpload] = useState<Upload>(null);
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayLocal());
  const [payerName, setPayerName] = useState("");
  const [mode, setMode] = useState<"UPI" | "BANK_TRANSFER" | "OTHER">("UPI");
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/tenant/rent/${chargeId}`, { cache: "no-store" });
    const result = await response.json() as Payload;
    if (!response.ok || !result.charge) throw new Error(result.error?.message ?? "Rent charge could not be loaded");
    setPayload(result);
    setAmount((result.charge.dueAmountPaise / 100).toFixed(2));
  }, [chargeId]);
  useEffect(() => {
    let active = true;
    void fetch(`/api/tenant/rent/${chargeId}`, { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as Payload;
      if (!response.ok || !result.charge) throw new Error(result.error?.message ?? "Rent charge could not be loaded");
      if (active) { setPayload(result); setAmount((result.charge.dueAmountPaise / 100).toFixed(2)); }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Rent charge could not be loaded"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chargeId]);

  async function uploadScreenshot(file?: File) {
    if (!file) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      const data = new FormData(); data.set("file", file);
      const response = await fetch("/api/tenant/uploads", { method: "POST", body: data });
      const result = await response.json() as { asset?: { id: string; previewUrl: string }; error?: { message?: string } };
      if (!response.ok || !result.asset) throw new Error(result.error?.message ?? "Screenshot upload failed");
      setUpload({ assetId: result.asset.id, previewUrl: result.asset.previewUrl });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Screenshot upload failed"); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!upload) { setError("Upload a payment screenshot before submitting."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/tenant/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        chargeId, transactionId, transactionDate, amountPaise: Math.round(Number(amount) * 100), payerName, mode,
        screenshot: { assetId: upload.assetId }, note,
      }) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Payment could not be submitted");
      setUpload(null); setNotice("Payment registered. Your PG owner will review it and update its status.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Payment could not be submitted"); }
    finally { setBusy(false); }
  }

  async function cancelPending() {
    if (!payload.pendingPayment) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/tenant/payments/${payload.pendingPayment.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Payment could not be cancelled");
      setNotice("Submission cancelled. You can register corrected payment details."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Payment could not be cancelled"); }
    finally { setBusy(false); }
  }

  if (loading) return <p role="status" className="rounded-2xl border bg-white p-6 text-sm text-foreground/60">Loading payment instructions…</p>;
  const charge = payload.charge;
  const details = payload.paymentDetails;
  if (!charge || !details) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error || "This rent charge is unavailable."}</p>;
  return <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
    <div className="grid content-start gap-5">
      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border p-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-900"}`}>{error || notice}</p>}
      <section className="rounded-2xl border bg-white p-6"><p className="text-xs font-bold uppercase tracking-wide text-foreground/45">{payload.pg?.name} · {charge.month}</p><h2 className="font-display text-primary mt-3 text-4xl">{money(charge.dueAmountPaise)}</h2><p className="mt-2 text-sm text-foreground/60">Outstanding · {money(charge.paidAmountPaise)} received against {money(charge.amountPaise)}</p><p className="mt-3 text-xs text-foreground/50">Rent window ends {new Date(charge.windowEnd).toLocaleDateString("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" })}</p><Link href="/tenant/rent" className="mt-5 inline-block text-sm font-semibold text-primary underline">Back to rent account</Link></section>
      <section className="rounded-2xl border bg-white p-6"><h2 className="font-display text-primary text-2xl">Pay the PG directly</h2><p className="mt-2 text-sm leading-6 text-foreground/60">Nelemane does not collect your payment. Use one of the owner’s payment methods, then register it here for verification.</p>
        {details.upiId && <div className="mt-5 rounded-xl border p-4"><p className="text-xs font-bold uppercase tracking-wide text-foreground/45">UPI ID</p><div className="mt-2 flex items-center justify-between gap-3"><code className="break-all text-sm font-semibold">{details.upiId}</code><button type="button" onClick={() => void navigator.clipboard.writeText(details.upiId)} className="shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold">Copy</button></div></div>}
        {details.qrImageUrl && <div className="mt-4 rounded-xl border p-4"><p className="text-xs font-bold uppercase tracking-wide text-foreground/45">Scan this private payment QR</p><Image src={details.qrImageUrl} alt={payload.pg?.name + " payment QR"} width={320} height={320} unoptimized className="mt-3 max-h-64 w-full rounded-lg object-contain" /><p className="mt-2 text-xs text-foreground/50">The secure image link expires in about one minute.</p></div>}
        {details.bank && <div className="mt-4 rounded-xl border p-4"><p className="text-xs font-bold uppercase tracking-wide text-foreground/45">Bank transfer</p><dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-foreground/50">Account holder</dt><dd className="font-semibold">{details.bank.accountHolderName}</dd></div><div><dt className="text-foreground/50">Bank</dt><dd className="font-semibold">{details.bank.bankName}</dd></div><div><dt className="text-foreground/50">Account number</dt><dd className="font-semibold">{details.bank.accountNumber} <button type="button" onClick={() => void navigator.clipboard.writeText(details.bank?.accountNumber ?? "")} className="ml-2 rounded-lg border px-2 py-1 text-xs">Copy</button></dd></div><div><dt className="text-foreground/50">IFSC</dt><dd className="font-semibold">{details.bank.ifsc} <button type="button" onClick={() => void navigator.clipboard.writeText(details.bank?.ifsc ?? "")} className="ml-2 rounded-lg border px-2 py-1 text-xs">Copy</button></dd></div>{details.bank.branch && <div><dt className="text-foreground/50">Branch</dt><dd className="font-semibold">{details.bank.branch}</dd></div>}</dl></div>}
        {details.instructions && <p className="mt-4 rounded-xl bg-muted/60 p-4 text-sm leading-6">{details.instructions}</p>}
        {payload.pg?.ownerPhone && <a href={`tel:${payload.pg.ownerPhone}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">Call PG owner</a>}
      </section>
    </div>
    <section className="rounded-2xl border bg-white p-6 sm:p-7"><h2 className="font-display text-primary text-2xl">Register your payment</h2><p className="mt-2 text-sm leading-6 text-foreground/60">Enter the bank or UPI transaction details so the owner can match and approve them.</p>
      {payload.pendingPayment ? <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="font-semibold text-amber-950">A payment is awaiting owner approval</p><p className="mt-1 text-sm text-amber-900">Submitted {money(payload.pendingPayment.amountPaise)} on {new Date(payload.pendingPayment.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}.</p><button type="button" disabled={busy} onClick={() => { void cancelPending(); }} className="mt-4 min-h-10 rounded-lg border border-amber-700 px-3 text-xs font-semibold text-amber-950 disabled:opacity-50">{busy ? "Please wait…" : "Cancel and resubmit"}</button></div> : charge.dueAmountPaise <= 0 ? <p className="mt-5 rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-900">This rent charge is fully paid.</p> : <form onSubmit={(event) => { void submit(event); }} className="mt-5 grid gap-4">
        <label className="text-sm font-semibold">Transaction ID / UTR<input required minLength={8} maxLength={35} pattern="[A-Za-z0-9]{8,35}" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /><span className="mt-1 block text-xs font-normal text-foreground/50">8–35 letters or numbers</span></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Transaction date<input required type="date" max={todayLocal()} value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Amount paid (₹)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Payer name<input required minLength={2} maxLength={120} value={payerName} onChange={(event) => setPayerName(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Payment method<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option></select></label></div>
        <label className="text-sm font-semibold">Payment screenshot<input required type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { void uploadScreenshot(event.target.files?.[0]); }} className="mt-2 block w-full text-xs file:mr-2 file:min-h-10 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:text-xs file:font-semibold file:text-white" /><span className="mt-1 block text-xs font-normal text-foreground/50">Private JPEG, PNG or WebP · up to 5 MB</span></label>
        {upload && <div className="flex items-center gap-3 rounded-xl border p-3"><Image src={upload.previewUrl} alt="Uploaded payment screenshot preview" width={64} height={64} unoptimized className="size-16 rounded-lg object-cover" /><span className="text-xs font-semibold">Private screenshot ready</span><button type="button" onClick={() => setUpload(null)} className="ml-auto text-xs font-semibold text-red-700 underline">Remove</button></div>}
        <label className="text-sm font-semibold">Note (optional)<textarea maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm font-normal" /></label>
        <button disabled={busy || !upload} className="bg-primary text-primary-foreground min-h-12 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">{busy ? "Submitting…" : "Submit for owner verification"}</button>
      </form>}
      <p className="mt-4 text-xs leading-5 text-foreground/50">Your daily payment registration limit is 10 submissions. Screenshots are private and only available to you and your PG owner.</p>
    </section>
  </div>;
}
