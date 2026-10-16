import { ReportsInbox } from "@/app/admin/reports/reports-inbox";
import { requireRoles } from "@/server/auth/authorization";

export default async function AdminReportsPage() {
  await requireRoles("SUPER_ADMIN");
  return <main className="mx-auto max-w-6xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Support queue</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Reports inbox</h1><p className="text-foreground/60 mt-2 text-sm">Review concerns sent to the platform and record how they were resolved.</p><ReportsInbox /></main>;
}
