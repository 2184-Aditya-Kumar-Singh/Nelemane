import { OwnerRentWorkspace } from "@/app/owner/rent/owner-rent-workspace";

export const dynamic = "force-dynamic";

export default function OwnerRentPage() {
  return <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Owner workspace</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Rent ledger</h1><p className="text-foreground/60 mt-2 text-sm">Track monthly collection, balances and payment history for your residents.</p><div className="mt-7"><OwnerRentWorkspace /></div></main>;
}
