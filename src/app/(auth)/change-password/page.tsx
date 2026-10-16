import { redirect } from "next/navigation";

import { PasswordForm } from "@/app/(auth)/_components/password-form";
import { requireAuthenticatedUser } from "@/server/auth/authorization";

export default async function ChangePasswordPage() {
  const user = await requireAuthenticatedUser().catch(() => null);
  if (!user) {
    redirect("/login");
  }

  return (
    <section className="border-border/80 bg-background/90 rounded-[1.75rem] border p-6 shadow-2xl shadow-indigo-950/10 backdrop-blur sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        {user.mustChangePassword ? "First sign-in" : "Account security"}
      </p>
      <h1 className="font-display text-primary mt-2 text-3xl font-medium tracking-tight">
        {user.mustChangePassword ? "Set a new password" : "Change your password"}
      </h1>
      <p className="text-foreground/65 mt-2 mb-7 text-sm leading-6">
        {user.mustChangePassword
          ? "For your security, change the temporary password before continuing."
          : "Choose a new password for your Nelemane account."}
      </p>
      <PasswordForm mode="change" />
    </section>
  );
}
