import { signOut } from "@/auth";
import { requireAuthenticatedUser } from "@/server/auth/authorization";
import Link from "next/link";

const roleLabel = {
  SUPER_ADMIN: "Super Admin",
  PG_OWNER: "PG Owner",
  TENANT: "Tenant",
} as const;

const roleDescription = {
  SUPER_ADMIN: "Platform administration",
  PG_OWNER: "Your PG workspace",
  TENANT: "Your resident account",
} as const;

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="bg-background min-h-screen px-5 py-10 sm:px-8">
      <section className="border-border/80 bg-background/90 mx-auto mt-12 max-w-2xl rounded-[1.75rem] border p-6 shadow-xl shadow-indigo-950/[0.06] sm:p-9">
        <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
          {roleLabel[user.role]}
        </p>
        <h1 className="font-display text-primary mt-2 text-3xl font-medium tracking-tight sm:text-4xl">
          Welcome, {user.name}
        </h1>
        <p className="text-foreground/65 mt-2 text-sm leading-6">
          {roleDescription[user.role]}. You are signed in as {user.email}.
        </p>

        <div className="border-border bg-muted/60 mt-7 rounded-2xl border p-5">
          <h2 className="text-sm font-semibold">Account security</h2>
          <p className="text-foreground/65 mt-1 text-sm leading-6">
            Your session is protected with an encrypted, HTTP-only cookie.
          </p>
          <a
            href="/change-password"
            className="text-primary mt-3 inline-flex min-h-10 items-center text-sm font-semibold hover:underline"
          >
            Change password
          </a>
          {user.role === "SUPER_ADMIN" && (
            <a
              href="/admin"
              className="bg-primary text-primary-foreground mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold hover:opacity-90"
            >
              Open admin console
            </a>
          )}
          {user.role === "PG_OWNER" && (
            <Link
              href="/owner"
              className="bg-primary text-primary-foreground mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold hover:opacity-90"
            >
              Open PG workspace
            </Link>
          )}
          {user.role === "TENANT" && (
            <Link
              href="/tenant"
              className="bg-primary text-primary-foreground mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold hover:opacity-90"
            >
              Open resident account
            </Link>
          )}
        </div>

        <form action={logout} className="mt-7">
          <button
            type="submit"
            className="border-border hover:bg-muted inline-flex min-h-11 items-center rounded-xl border px-5 text-sm font-semibold transition-colors"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
