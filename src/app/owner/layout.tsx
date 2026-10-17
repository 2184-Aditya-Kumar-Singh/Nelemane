import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AuthorizationError, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { PaymentModel } from "@/server/db/models/payment";

const navigation = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/pg-details", label: "PG details" },
  { href: "/owner/rooms", label: "Rooms & types" },
  { href: "/owner/tenants", label: "Tenants" },
  { href: "/owner/rent", label: "Rent ledger" },
  { href: "/owner/payment-verifications", label: "Payment verifications" },
  { href: "/owner/menu", label: "Weekly menu" },
  { href: "/owner/tickets", label: "Maintenance tickets" },
];

export default async function OwnerLayout({ children }: Readonly<{ children: ReactNode }>) {
  let pendingPayments = 0;
  try {
    const user = await requireRoles("PG_OWNER");
    pendingPayments = await PaymentModel.countDocuments({ pgId: requirePgScope(user), source: "TENANT", status: "PENDING" });
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(error.status === 401 ? "/login" : "/dashboard?denied=1");
    throw error;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-border border-b bg-white/80 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/owner" className="font-display text-primary text-2xl font-semibold tracking-tight">Nelemane <span className="text-accent text-sm font-sans font-bold tracking-[0.14em] uppercase">Owner</span></Link>
          <nav aria-label="Owner navigation" className="flex flex-wrap gap-2">
            {navigation.map((item) => <Link key={item.href} href={item.href} className="hover:bg-muted min-h-10 rounded-xl px-3 py-2 text-sm font-semibold transition-colors">{item.label}{item.href === "/owner/payment-verifications" && pendingPayments > 0 && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">{pendingPayments}</span>}</Link>)}
            <Link href="/dashboard" className="text-foreground/60 hover:bg-muted min-h-10 rounded-xl px-3 py-2 text-sm font-semibold transition-colors">Account</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
