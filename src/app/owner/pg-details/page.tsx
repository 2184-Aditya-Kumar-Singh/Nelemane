import { PgDetailsForm } from "./pg-details-form";

export default function OwnerPgDetailsPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
      <div className="mb-7">
        <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Your public profile</p>
        <h1 className="font-display text-primary mt-2 text-4xl font-medium">PG details</h1>
        <p className="text-foreground/60 mt-2 max-w-2xl text-sm leading-6">Keep your listing accurate and complete. Payment information is stored securely and every change is recorded.</p>
      </div>
      <PgDetailsForm />
    </main>
  );
}
