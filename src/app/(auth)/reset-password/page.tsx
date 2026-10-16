import { PasswordForm } from "@/app/(auth)/_components/password-form";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  return (
    <section className="border-border/80 bg-background/90 rounded-[1.75rem] border p-6 shadow-2xl shadow-indigo-950/10 backdrop-blur sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Account recovery
      </p>
      <h1 className="font-display text-primary mt-2 text-3xl font-medium tracking-tight">
        Choose a new password
      </h1>
      <p className="text-foreground/65 mt-2 mb-7 text-sm leading-6">
        Reset links can be used once and expire after 30 minutes.
      </p>
      <PasswordForm mode="reset" token={token} />
    </section>
  );
}
