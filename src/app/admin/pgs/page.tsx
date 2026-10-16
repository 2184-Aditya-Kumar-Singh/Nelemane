import Link from "next/link";

import { requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel } from "@/server/db/models/pg";
import { serializePgListItem } from "@/server/admin/serializers";
import { PgList } from "@/app/admin/pgs/pg-list";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; status?: string; subscription?: string }>;

export default async function AdminPgsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRoles("SUPER_ADMIN");
  await connectToDatabase();
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) ?? "";
  const status = params.status === "DELETED" ? "DELETED" : params.status === "ACTIVE" ? "ACTIVE" : "";
  const subscription = ["ACTIVE", "SUSPENDED", "CANCELLED"].includes(params.subscription ?? "") ? params.subscription : "";
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (subscription) filter["subscription.status"] = subscription;
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { slug: { $regex: escaped, $options: "i" } },
      { "owner.name": { $regex: escaped, $options: "i" } },
      { "owner.email": { $regex: escaped, $options: "i" } },
      { "address.locality": { $regex: escaped, $options: "i" } },
    ];
  }
  const pgs = await PgModel.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  const items = pgs.map((pg) => serializePgListItem(pg as never));

  return (
    <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Platform records</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">PG directory</h1><p className="text-foreground/60 mt-2 text-sm">Search and manage registered properties and subscriptions.</p></div>
        <Link href="/admin/pgs/new" className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold">Register PG</Link>
      </div>
      <form action="/admin/pgs" className="mt-7 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_180px_200px_auto] sm:items-end">
        <label className="text-xs font-semibold">Search<div className="mt-1"><input name="q" defaultValue={q} placeholder="PG, owner, email or locality" className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm" /></div></label>
        <label className="text-xs font-semibold">Record status<div className="mt-1"><select name="status" defaultValue={status} className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm"><option value="">All</option><option value="ACTIVE">Active</option><option value="DELETED">Deleted</option></select></div></label>
        <label className="text-xs font-semibold">Subscription<div className="mt-1"><select name="subscription" defaultValue={subscription} className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm"><option value="">All</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="CANCELLED">Cancelled</option></select></div></label>
        <button className="bg-primary text-primary-foreground min-h-11 rounded-xl px-5 text-sm font-semibold">Apply</button>
      </form>
      <PgList pgs={items} />
    </main>
  );
}
