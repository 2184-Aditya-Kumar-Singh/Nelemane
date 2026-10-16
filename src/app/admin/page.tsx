import Link from "next/link";

import { requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { AdminReportModel } from "@/server/db/models/admin-report";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { UserModel } from "@/server/db/models/user";

export const dynamic = "force-dynamic";

const statCards = [
  { key: "totalPgs", title: "Registered PGs", caption: "All platform records" },
  { key: "activeTenants", title: "Active tenants", caption: "Resident accounts" },
  { key: "expiringSubscriptions", title: "Expiring soon", caption: "Subscriptions ending in 30 days" },
  { key: "openReports", title: "Open reports", caption: "Waiting for admin review" },
] as const;

function humanize(action: string): string {
  return action.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AdminDashboardPage() {
  await requireRoles("SUPER_ADMIN");
  await connectToDatabase();
  const now = new Date();
  const within30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [totalPgs, activeTenants, expiringSubscriptions, openReports, recentActivity] = await Promise.all([
    PgModel.countDocuments(),
    UserModel.countDocuments({ role: "TENANT", status: "ACTIVE" }),
    PgModel.countDocuments({ status: "ACTIVE", "subscription.status": "ACTIVE", "subscription.endsAt": { $gte: now, $lte: within30Days } }),
    AdminReportModel.countDocuments({ status: "OPEN" }),
    AuditLogModel.find().sort({ createdAt: -1 }).limit(8).populate("actorId", "name email").lean(),
  ]);
  const stats = { totalPgs, activeTenants, expiringSubscriptions, openReports };

  return (
    <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Platform overview</p>
          <h1 className="font-display text-primary mt-2 text-4xl font-medium tracking-tight">Admin dashboard</h1>
          <p className="text-foreground/60 mt-2 text-sm">Manage PG registrations, subscriptions, reports and platform activity.</p>
        </div>
        <Link href="/admin/pgs/new" className="bg-primary text-primary-foreground hover:opacity-90 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-opacity">Register a PG</Link>
      </div>

      <section aria-label="Platform statistics" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <article key={card.key} className="border-border rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-foreground/55 text-sm font-medium">{card.title}</p>
            <p className="font-display text-primary mt-3 text-4xl font-medium">{stats[card.key].toLocaleString("en-IN")}</p>
            <p className="text-foreground/50 mt-2 text-xs">{card.caption}</p>
          </article>
        ))}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="border-border rounded-2xl border bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="font-display text-primary text-2xl font-medium">Recent activity</h2><p className="text-foreground/55 mt-1 text-sm">Latest changes recorded in the audit log.</p></div>
            <Link href="/admin/audit" className="text-primary text-sm font-semibold hover:underline">View all</Link>
          </div>
          {recentActivity.length ? (
            <ol className="mt-5 divide-y divide-border">
              {recentActivity.map((item) => {
                const actor = item.actorId && typeof item.actorId === "object" && "name" in item.actorId ? String(item.actorId.name) : "System";
                return <li key={item._id.toString()} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{humanize(item.action)}</p><p className="text-foreground/55 text-xs">{actor} · {item.entity}</p></div><time className="text-foreground/45 text-xs" dateTime={item.createdAt.toISOString()}>{item.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></li>;
              })}
            </ol>
          ) : <p className="text-foreground/55 mt-6 rounded-xl bg-muted/50 p-4 text-sm">No platform activity has been recorded yet.</p>}
        </section>

        <section className="border-border rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="font-display text-primary text-2xl font-medium">Quick links</h2>
          <div className="mt-4 grid gap-3">
            <Link href="/admin/pgs" className="hover:bg-muted rounded-xl border p-4 transition-colors"><span className="block text-sm font-semibold">PG directory</span><span className="text-foreground/55 mt-1 block text-xs">Search, update and manage registrations</span></Link>
            <Link href="/admin/reports" className="hover:bg-muted rounded-xl border p-4 transition-colors"><span className="block text-sm font-semibold">Reports inbox</span><span className="text-foreground/55 mt-1 block text-xs">Review and resolve issues escalated to the platform</span></Link>
            <Link href="/admin/audit" className="hover:bg-muted rounded-xl border p-4 transition-colors"><span className="block text-sm font-semibold">Audit history</span><span className="text-foreground/55 mt-1 block text-xs">Filter account and subscription changes</span></Link>
          </div>
        </section>
      </div>
    </main>
  );
}
