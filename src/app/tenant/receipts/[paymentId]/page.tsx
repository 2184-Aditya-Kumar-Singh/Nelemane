import { notFound } from "next/navigation";
import { Types } from "mongoose";

import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { PaymentModel } from "@/server/db/models/payment";
import { PgModel } from "@/server/db/models/pg";
import { PrintReceipt } from "@/app/tenant/receipts/[paymentId]/print-receipt";

export const dynamic = "force-dynamic";

export default async function TenantReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { tenant, pgId } = await requireActiveTenant();
  const { paymentId } = await params;
  if (!Types.ObjectId.isValid(paymentId)) notFound();
  const [payment, pg] = await Promise.all([
    PaymentModel.findOne({ _id: paymentId, pgId, tenantId: tenant._id, status: "APPROVED" }).lean(),
    PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name address.locality").lean(),
  ]);
  if (!payment || !pg || !payment.approvedAmount) notFound();
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  return <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><div className="mb-5 flex items-center justify-between gap-3 print:hidden"><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Payment receipt</p><PrintReceipt /></div><article className="rounded-3xl border bg-white p-7 shadow-sm sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none"><div className="flex items-start justify-between gap-4 border-b pb-6"><div><p className="font-display text-primary text-3xl font-semibold">Nelemane</p><h1 className="mt-1 text-lg font-semibold">Rent payment receipt</h1><p className="mt-1 text-sm text-foreground/55">{pg.name} · {pg.address.locality}</p></div><span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-900">APPROVED</span></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wide text-foreground/45">Receipt number</p><p className="mt-1 font-mono text-sm">{payment._id.toString().toUpperCase()}</p></div><div><p className="text-xs uppercase tracking-wide text-foreground/45">Rent month</p><p className="mt-1 font-semibold">{payment.month}</p></div><div><p className="text-xs uppercase tracking-wide text-foreground/45">Received from</p><p className="mt-1 font-semibold">{tenant.name}</p></div><div><p className="text-xs uppercase tracking-wide text-foreground/45">Approved on</p><p className="mt-1 font-semibold">{payment.reviewedAt?.toLocaleDateString("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }) ?? "—"}</p></div><div><p className="text-xs uppercase tracking-wide text-foreground/45">Payment method</p><p className="mt-1 font-semibold">{payment.mode.replaceAll("_", " ")}</p></div><div><p className="text-xs uppercase tracking-wide text-foreground/45">Transaction ID</p><p className="mt-1 font-mono text-sm">{payment.transactionId ?? "Recorded by PG owner"}</p></div></div><div className="mt-8 rounded-2xl bg-muted/60 p-5"><p className="text-xs uppercase tracking-wide text-foreground/50">Amount received</p><p className="font-display text-primary mt-2 text-4xl font-semibold">{money.format(payment.approvedAmount / 100)}</p></div><p className="mt-6 text-xs leading-5 text-foreground/50">This receipt confirms the payment approval recorded by the PG owner in Nelemane. Keep it with your records.</p></article></main>;
}
