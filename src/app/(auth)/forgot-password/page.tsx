import { APP_NAME } from "@/config/app";
import { PasswordForm } from "@/app/(auth)/_components/password-form";

export default function ForgotPasswordPage() {
  return (
    <section className="border-border/80 bg-background/90 rounded-[1.75rem] border p-6 shadow-2xl shadow-indigo-950/10 backdrop-blur sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Account recovery
      </p>
      <h1 className="font-display text-primary mt-2 text-3xl font-medium tracking-tight">
        Reset your password
      </h1>
      <p className="text-foreground/65 mt-2 mb-7 text-sm leading-6">
        Enter the email for your {APP_NAME} account. If it is active, we will send a reset link that expires in 30 minutes.
      </p>
      <PasswordForm mode="request" />
    </section>
  );
}
