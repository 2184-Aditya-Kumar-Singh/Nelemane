"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type PaymentHistory = { id: string; status: string; submittedPaise: number; approvedPaise: number | null; mode: string; transactionId: string; createdAt: string };
type Row = { id: string; tenantId: string; tenantName: string; email: string; phone: string; tenantStatus: string; roomNumber: string; floor: string; block: string; roomType: string; month: string; amountPaise: number; paidAmountPaise: number; dueAmountPaise: number; status: string; windowStart: string; windowEnd: string; pendingPaymentPaise: number; paymentHistory: PaymentHistory[] };
type Totals = { collectedPaise: number; outstandingPaise: number; pendingVerificationPaise: number; overduePaise: number; tenantCount: number };
type RoomSummary = { label: string; residents: number; duePaise: number; overduePaise: number; pendingPaise: number };
type ApiError = { error?: { message?: string } };
type Photo = { assetId: string } | null;
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
function todayLocal() { const date = new Date(); return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0"); }
function Status({ value }: { value: string }) { const color = value === "PAID" ? "bg-green-100 text-green-900" : value === "OVERDUE" ? "bg-red-100 text-red-900" : value === "PENDING_VERIFICATION" ? "bg-amber-100 text-amber-950" : "bg-muted text-foreground/60"; return <span className={"rounded-full px-2.5 py-1 text-[11px] font-bold " + color}>{value.replaceAll("_", " ")}</span>; }

function RecordPaymentForm({ row, onSaved }: { row: Row; onSaved: () => Promise<void> }) {
  const [mode, setMode] = useState<"CASH" | "UPI" | "BANK_TRANSFER">("CASH");
  const [transactionId, setTransactionId] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayLocal());
  const [amount, setAmount] = useState((row.dueAmountPaise / 100).toFixed(2));
  const [payerName, setPayerName] = useState(row.tenantName);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<Photo>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const data = new FormData(); data.set("purpose", "OWNER_PAYMENT_PROOF"); data.set("file", file);
      const response = await fetch("/api/owner/uploads", { method: "POST", body: data });
      const result = await response.json() as { asset?: { id: string }; error?: { message?: string } };
      if (!response.ok || !result.asset) throw new Error(result.error?.message ?? "Proof upload failed");
      setPhoto({ assetId: result.asset.id });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Proof upload failed"); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/owner/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        tenantId: row.tenantId, chargeId: row.id, mode, transactionId, transactionDate,
        amountPaise: Math.round(Number(amount) * 100), payerName, note, screenshot: photo,
      }) });
      const result = await response.json() as ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "Payment could not be recorded");
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Payment could not be recorded"); }
    finally { setBusy(false); }
  }

  return <form onSubmit={(event) => { void submit(event); }} className="mt-4 grid gap-3 rounded-xl border bg-background p-4"><p className="text-sm font-semibold">Record a payment received directly</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Method<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm font-normal"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option></select></label><label className="text-xs font-semibold">Amount received (₹)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm font-normal" /></label><label className="text-xs font-semibold">Transaction ID {mode === "CASH" ? "(optional)" : ""}<input required={mode !== "CASH"} minLength={transactionId ? 8 : undefined} maxLength={35} value={transactionId} onChange={(event) => setTransactionId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm font-normal" /></label><label className="text-xs font-semibold">Received on<input required type="date" max={todayLocal()} value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm font-normal" /></label><label className="text-xs font-semibold">Payer name<input required minLength={2} value={payerName} onChange={(event) => setPayerName(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm font-normal" /></label><label className="text-xs font-semibold">Private proof (optional)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); }} className="mt-2 block w-full text-[11px]" />{photo && <span className="mt-1 block text-green-800">Proof ready</span>}</label></div><label className="text-xs font-semibold">Note<textarea rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}<div className="flex gap-2"><button disabled={busy} className="min-h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Record payment"}</button>{photo && <button type="button" onClick={() => setPhoto(null)} className="rounded-lg border px-3 text-xs font-semibold">Remove proof</button>}</div></form>;
}

export function OwnerRentWorkspace() {
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [roomSummaries, setRoomSummaries] = useState<RoomSummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/owner/rent?month=" + month, { cache: "no-store" });
    const result = await response.json() as { rows?: Row[]; totals?: Totals; roomSummaries?: RoomSummary[] } & ApiError;
    if (!response.ok || !result.rows || !result.totals) throw new Error(result.error?.message ?? "Rent ledger could not be loaded");
    setRows(result.rows); setTotals(result.totals); setRoomSummaries(result.roomSummaries ?? []);
  }, [month]);
  useEffect(() => {
    let active = true;
    void fetch("/api/owner/rent?month=" + month, { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { rows?: Row[]; totals?: Totals; roomSummaries?: RoomSummary[] } & ApiError;
      if (!response.ok || !result.rows || !result.totals) throw new Error(result.error?.message ?? "Rent ledger could not be loaded");
      if (active) { setRows(result.rows); setTotals(result.totals); setRoomSummaries(result.roomSummaries ?? []); }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Rent ledger could not be loaded"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month]);

  async function sendReminder(chargeId?: string) {
    const target = chargeId ? "this tenant" : "all residents with an unpaid balance";
    if (!window.confirm("Send a rent reminder to " + target + "?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/owner/rent/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, ...(chargeId ? { chargeId } : {}) }) });
      const result = await response.json() as { sent?: number } & ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "Reminder could not be sent");
      setNotice("Reminder request processed for " + (result.sent ?? 0) + " resident(s). Delivery may be skipped when today's reminder was already sent or a channel is not configured.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Reminder could not be sent"); }
    finally { setBusy(false); }
  }

  function exportCsv() {
    const escape = (value: string) => {
      const safe = /^[=+\-@]/.test(value) ? "'" + value : value;
      return "\"" + safe.replaceAll("\"", "\"\"") + "\"";
    };
    const csvRows = [["Month", "Tenant", "Email", "Phone", "Room", "Status", "Rent (INR)", "Paid (INR)", "Due (INR)"], ...visible.map((row) => [row.month, row.tenantName, row.email, row.phone, row.roomNumber, row.status, (row.amountPaise / 100).toFixed(2), (row.paidAmountPaise / 100).toFixed(2), (row.dueAmountPaise / 100).toFixed(2)])];
    const csv = csvRows.map((line) => line.map((cell) => escape(String(cell))).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "nelemane-rent-" + month + ".csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  const visible = rows.filter((row) => [row.tenantName, row.email, row.roomNumber, row.phone].join(" ").toLowerCase().includes(search.toLowerCase()) && (statusFilter === "ALL" || row.status === statusFilter));
  return <div className="grid gap-5">
    {(error || notice) && <p role={error ? "alert" : "status"} className={"rounded-xl border p-4 text-sm font-semibold " + (error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-900")}>{error || notice}</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Collected", totals?.collectedPaise ?? 0], ["Outstanding", totals?.outstandingPaise ?? 0], ["Pending verification", totals?.pendingVerificationPaise ?? 0], ["Overdue", totals?.overduePaise ?? 0]].map(([label, value]) => <article key={String(label)} className="rounded-2xl border bg-white p-5"><p className="text-xs font-semibold text-foreground/50">{label}</p><p className="font-display text-primary mt-2 text-3xl">{money(Number(value))}</p></article>)}</section>
    <div className="flex flex-col gap-4 rounded-2xl border bg-white p-5 lg:flex-row lg:items-end lg:justify-between"><div className="flex flex-wrap items-end gap-3"><label className="text-xs font-semibold">Rent month<input type="month" value={month} onChange={(event) => { setLoading(true); setMonth(event.target.value); }} className="mt-1 block min-h-10 rounded-lg border bg-background px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">Search residents<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone or room" className="mt-1 block min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal sm:w-72" /></label><label className="text-xs font-semibold">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block min-h-10 rounded-lg border bg-background px-3 text-sm font-normal"><option value="ALL">All</option><option value="UNPAID">Unpaid</option><option value="PENDING_VERIFICATION">Pending</option><option value="PARTIALLY_PAID">Partial</option><option value="PAID">Paid</option><option value="OVERDUE">Overdue</option></select></label></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => { void sendReminder(); }} className="min-h-10 rounded-lg border px-4 text-xs font-semibold disabled:opacity-50">Remind all unpaid</button><button type="button" onClick={exportCsv} className="min-h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground">Export CSV</button></div></div>
    {roomSummaries.length > 0 && <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="font-display text-primary text-xl">Dues by room</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-foreground/55"><tr><th className="px-4 py-3">Room</th><th className="px-4 py-3">Residents</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Overdue</th><th className="px-4 py-3">Under review</th></tr></thead><tbody className="divide-y">{roomSummaries.map((room) => <tr key={room.label}><td className="px-4 py-3 font-semibold">{room.label}</td><td className="px-4 py-3">{room.residents}</td><td className="px-4 py-3">{money(room.duePaise)}</td><td className="px-4 py-3">{money(room.overduePaise)}</td><td className="px-4 py-3">{money(room.pendingPaise)}</td></tr>)}</tbody></table></div></section>}
    {loading ? <p role="status" className="rounded-2xl border bg-white p-6 text-sm text-foreground/60">Loading rent ledger…</p> : visible.length ? <div className="grid gap-3">{visible.map((row) => <article key={row.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{row.tenantName}</h2><Status value={row.status} /><span className="text-xs text-foreground/50">Room {row.roomNumber}{row.roomType ? " · " + row.roomType : ""}</span>{row.tenantStatus !== "ACTIVE" && <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold">VACATED</span>}</div><p className="mt-1 text-xs text-foreground/55">{row.email} · {row.phone} · Window ends {new Date(row.windowEnd).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span>Rent <strong>{money(row.amountPaise)}</strong></span><span>Paid <strong>{money(row.paidAmountPaise)}</strong></span><span>Due <strong>{money(row.dueAmountPaise)}</strong></span>{row.pendingPaymentPaise > 0 && <span>Under review <strong>{money(row.pendingPaymentPaise)}</strong></span>}</div></div><div className="flex flex-wrap gap-2">{row.dueAmountPaise > 0 && <button type="button" disabled={busy} onClick={() => { void sendReminder(row.id); }} className="min-h-10 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50">Remind</button>}{row.dueAmountPaise > 0 && row.tenantStatus === "ACTIVE" && <details className="relative"><summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">Record payment</summary><div className="absolute right-0 z-10 mt-2 w-[min(90vw,34rem)] rounded-2xl border bg-white p-4 shadow-xl"><RecordPaymentForm row={row} onSaved={async () => { await refresh(); setNotice("Payment recorded and rent balance updated."); }} /></div></details>}</div></div>
      {row.paymentHistory.length > 0 && <details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-xs font-semibold text-primary">Payment history ({row.paymentHistory.length})</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{row.paymentHistory.map((payment) => <div key={payment.id} className="rounded-lg bg-muted/50 p-3 text-xs"><div className="flex justify-between gap-2"><strong>{payment.status} · {payment.mode.replaceAll("_", " ")}</strong><span>{new Date(payment.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span></div><p className="mt-1">Submitted {money(payment.submittedPaise)}{payment.approvedPaise !== null ? " · approved " + money(payment.approvedPaise) : ""}{payment.transactionId ? " · " + payment.transactionId : ""}</p></div>)}</div></details>}</article>)}</div> : <section className="rounded-2xl border bg-white p-8 text-center"><h2 className="font-display text-primary text-2xl">No rent charges for {month}</h2><p className="mt-2 text-sm text-foreground/55">Charges are generated idempotently for the current month. Older months appear after the scheduled rent job has run.</p></section>}
  </div>;
}
