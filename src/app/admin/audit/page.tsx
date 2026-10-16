import { AuditViewer } from "@/app/admin/audit/audit-viewer";
import { requireRoles } from "@/server/auth/authorization";

export default async function AdminAuditPage() {
  await requireRoles("SUPER_ADMIN");
  return <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Platform history</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Audit log</h1><p className="text-foreground/60 mt-2 text-sm">Filter recorded account, property, subscription and admin actions.</p><AuditViewer /></main>;
}
