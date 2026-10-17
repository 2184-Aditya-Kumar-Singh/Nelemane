import { TenantRentWorkspace } from "@/app/tenant/rent/tenant-rent-workspace";

export const dynamic = "force-dynamic";

export default function TenantRentPage() {
  return <main className="mx-auto max-w-6xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Account statement</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Rent & payments</h1><p className="text-foreground/60 mt-2 text-sm">View monthly charges, register transfers and track payment approvals.</p><div className="mt-7"><TenantRentWorkspace /></div></main>;
}
