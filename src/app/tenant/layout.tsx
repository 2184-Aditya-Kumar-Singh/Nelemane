import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AuthorizationError } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";

export default async function TenantLayout({ children }: Readonly<{ children: ReactNode }>) {
  try {
    await requireActiveTenant();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(error.status === 401 ? "/login" : "/dashboard?denied=1");
    throw error;
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-border border-b bg-white/80 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/tenant" className="font-display text-primary text-2xl font-semibold tracking-tight">Nelemane <span className="text-accent text-sm font-sans font-bold tracking-[0.14em] uppercase">Resident</span></Link>
          <nav aria-label="Resident navigation" className="flex flex-wrap gap-2">
            <Link href="/tenant" className="hover:bg-muted min-h-10 rounded-xl px-3 py-2 text-sm font-semibold">Overview</Link>
            <Link href="/tenant/rent" className="hover:bg-muted min-h-10 rounded-xl px-3 py-2 text-sm font-semibold">Rent & payments</Link>
            <Link href="/tenant/menu" className="hover:bg-muted min-h-10 rounded-xl px-3 py-2 text-sm font-semibold">Weekly menu</Link>
            <Link href="/tenant/tickets" className="hover:bg-muted min-h-10 rounded-xl px-3 py-2 text-sm font-semibold">Maintenance</Link>
            <Link href="/tenant/profile" className="hover:bg-muted min-h-10 rounded-xl px-3 py-2 text-sm font-semibold">My profile</Link>
            <Link href="/dashboard" className="text-foreground/60 hover:bg-muted min-h-10 rounded-xl px-3 py-2 text-sm font-semibold">Account</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
