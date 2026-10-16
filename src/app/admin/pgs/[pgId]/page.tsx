import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";

import { PgEditForm } from "@/app/admin/pgs/[pgId]/pg-edit-form";
import { requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel } from "@/server/db/models/pg";
import { serializePgAdminDetail } from "@/server/admin/serializers";
import { getStorageProvider } from "@/server/providers/storage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ pgId: string }>;
  searchParams: Promise<{ created?: string; credentials?: string }>;
};

export default async function AdminPgDetailsPage({ params, searchParams }: PageProps) {
  await requireRoles("SUPER_ADMIN");
  const [{ pgId }, query] = await Promise.all([params, searchParams]);
  if (!Types.ObjectId.isValid(pgId)) notFound();
  await connectToDatabase();
  const pg = await PgModel.findById(pgId).lean();
  if (!pg) notFound();
  const details = serializePgAdminDetail(pg as never);
  const qrPublicId = pg.paymentDetails.qrImage?.publicId;
  const qrPreviewUrl = qrPublicId ? await getStorageProvider().getSignedUrl(qrPublicId, 60).catch(() => "") : "";
  const credentialsDelivery = query.credentials === "SENT" || query.credentials === "SKIPPED" || query.credentials === "FAILED" ? query.credentials : "";

  return (
    <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
      <Link href="/admin/pgs" className="text-primary text-sm font-semibold hover:underline">← Back to PG directory</Link>
      {query.created === "1" && <div role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">PG registration completed. {credentialsDelivery === "SENT" ? "Owner credentials were emailed." : credentialsDelivery === "SKIPPED" ? "Development email was skipped; see the local server terminal for the development email." : "Owner email failed; the owner can use password recovery before signing in."}</div>}
      <div className="mt-5"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">PG details · {details.slug}</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">{details.name}</h1><p className="text-foreground/60 mt-2">{details.address.line1}, {details.address.locality}, {details.address.city} · {details.address.pincode}</p></div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <PgEditForm pg={details} />
        <section className="border-border h-fit rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="font-display text-primary text-2xl font-medium">Registration details</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <Detail label="Subscription" value={`${details.subscription.planLabel} · ${details.subscription.status}`} />
            <Detail label="Subscription dates" value={`${details.subscription.startsAt} — ${details.subscription.endsAt}`} />
            <Detail label="Listing status" value={details.isListed ? "Public listing enabled" : "Hidden from public listings"} />
            <Detail label="Account type" value={details.paymentDetails.accountType} />
            {details.paymentDetails.upiId && <Detail label="UPI ID" value={details.paymentDetails.upiId} />}
            {details.paymentDetails.bank && <Detail label="Bank" value={`${details.paymentDetails.bank.bankName} · account ending ${details.paymentDetails.bank.accountNumberLastFour}`} />}
            {details.paymentDetails.bank && <Detail label="IFSC" value={details.paymentDetails.bank.ifsc} />}
            {details.paymentDetails.qrImage && <div className="border-border flex items-center justify-between gap-3 rounded-xl border p-3"><span className="text-foreground/55 text-xs">Private payment QR image</span>{qrPreviewUrl ? <a href={qrPreviewUrl} target="_blank" rel="noreferrer" className="text-primary text-sm font-semibold underline">Open secure preview</a> : <span className="text-foreground/50 text-xs">Preview unavailable</span>}</div>}
            <Detail label="Created" value={new Date(details.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />
          </dl>
          <p className="text-foreground/50 mt-5 text-xs leading-5">Bank account numbers are encrypted at rest. This admin view shows only the last four digits.</p>
        </section>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="border-border flex flex-wrap justify-between gap-2 border-b pb-3"><dt className="text-foreground/55">{label}</dt><dd className="text-right font-medium">{value}</dd></div>;
}
