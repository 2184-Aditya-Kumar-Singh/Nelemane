import Link from "next/link";

import { TenantWorkspace } from "./tenant-workspace";

export default function OwnerTenantsPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Residents</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Tenants</h1><p className="text-foreground/60 mt-2 text-sm">Manage resident accounts, room assignments and move-outs.</p></div>
        <Link href="/owner/tenants/new" className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold">Add tenant</Link>
      </div>
      <TenantWorkspace />
    </main>
  );
}
