import Link from "next/link";

import { RegistrationWizard } from "@/app/admin/pgs/new/registration-wizard";
import { requireRoles } from "@/server/auth/authorization";

export default async function RegisterPgPage() {
  await requireRoles("SUPER_ADMIN");
  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-8">
      <Link href="/admin/pgs" className="text-primary text-sm font-semibold hover:underline">← Back to PG directory</Link>
      <div className="mt-5"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">New registration</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Register a PG</h1><p className="text-foreground/60 mt-2 text-sm">Create a property and its owner account in one secure transaction.</p></div>
      <RegistrationWizard />
    </main>
  );
}
