import { AddTenantForm } from "./tenant-form";

export default function AddTenantPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Resident onboarding</p>
      <h1 className="font-display text-primary mt-2 text-4xl font-medium">Add a tenant</h1>
      <p className="text-foreground/60 mt-2 max-w-2xl text-sm leading-6">Add the resident to a room and create their sign-in account. Aadhaar is optional; consent is required before it is stored.</p>
      <div className="mt-7"><AddTenantForm /></div>
    </main>
  );
}
