import Link from "next/link";
import { signIn } from "@/auth";
import { APP_NAME } from "@/config/app";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; changed?: string; callbackUrl?: string }>;
}

const inputClassName =
  "border-border bg-background text-foreground placeholder:text-foreground/40 focus:border-primary min-h-12 w-full rounded-xl border px-4 text-sm outline-none transition-colors";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = Boolean(params.error);

  async function login(formData: FormData) {
    "use server";

    const requested = String(formData.get("callbackUrl") ?? "");
    const redirectTo = requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")
      ? requested
      : "/dashboard";

    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo,
    });
  }

  return (
    <section className="border-border/80 bg-background/90 rounded-[1.75rem] border p-6 shadow-2xl shadow-indigo-950/10 backdrop-blur sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Welcome back
      </p>
      <h1 className="font-display text-primary mt-2 text-3xl font-medium tracking-tight">
        Sign in to {APP_NAME}
      </h1>
      <p className="text-foreground/65 mt-2 text-sm leading-6">
        Continue to your Nelemane account.
      </p>

      {params.changed === "1" ? (
        <p className="mt-5 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      {hasError ? (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          Email or password is incorrect, or the account is temporarily locked.
        </p>
      ) : null}

      <form action={login} className="mt-7 space-y-5">
        {params.callbackUrl && <input type="hidden" name="callbackUrl" value={params.callbackUrl} />}
        <label className="block space-y-2 text-sm font-semibold">
          Email address
          <input
            className={inputClassName}
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          Password
          <input
            className={inputClassName}
            type="password"
            name="password"
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>
        <button
          type="submit"
          className="bg-primary text-primary-foreground inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-md shadow-indigo-950/10 transition-opacity hover:opacity-90"
        >
          Sign in
        </button>
      </form>

      <p className="mt-5 text-center text-sm">
        <Link href="/forgot-password" className="text-primary font-semibold hover:underline">
          Forgot your password?
        </Link>
      </p>
    </section>
  );
}
