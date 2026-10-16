"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";

type PasswordFormMode = "request" | "reset" | "change";

interface PasswordFormProps {
  mode: PasswordFormMode;
  token?: string;
}

interface ApiResponse {
  message?: string;
  error?: { message?: string };
}

const inputClassName =
  "border-border bg-background text-foreground placeholder:text-foreground/40 focus:border-primary min-h-12 w-full rounded-xl border px-4 text-sm outline-none transition-colors";

export function PasswordForm({ mode, token }: PasswordFormProps) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const endpoint =
    mode === "request"
      ? "/api/auth/forgot-password"
      : mode === "reset"
        ? "/api/auth/reset-password"
        : "/api/account/password";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload =
      mode === "request"
        ? { email: formData.get("email") }
        : mode === "reset"
          ? {
              token,
              newPassword: formData.get("newPassword"),
            }
          : {
              currentPassword: formData.get("currentPassword"),
              newPassword: formData.get("newPassword"),
            };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: result.error?.message ?? "We could not update your password.",
        });
        return;
      }

      if (mode === "change") {
        await signOut({ redirectTo: "/login?changed=1" });
        return;
      }

      setFeedback({
        kind: "success",
        message: result.message ?? "Your request was received.",
      });
      form.reset();
    } catch {
      setFeedback({
        kind: "error",
        message: "A network error occurred. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-5">
        {mode === "request" ? (
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
        ) : null}

        {mode === "change" ? (
          <label className="block space-y-2 text-sm font-semibold">
            Current password
            <input
              className={inputClassName}
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              maxLength={128}
              required
            />
          </label>
        ) : null}

        {mode !== "request" ? (
          <label className="block space-y-2 text-sm font-semibold">
            New password
            <input
              className={inputClassName}
              type="password"
              name="newPassword"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <span className="text-foreground/55 block text-xs font-normal">
              Use at least 12 characters.
            </span>
          </label>
        ) : null}

        <button
          type="submit"
          disabled={pending || (mode === "reset" && !token)}
          className="bg-primary text-primary-foreground inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-md shadow-indigo-950/10 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {pending
            ? "Please wait…"
            : mode === "request"
              ? "Send reset link"
              : mode === "reset"
                ? "Set new password"
                : "Update password"}
        </button>

        {feedback ? (
          <p
            aria-live="polite"
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`rounded-xl px-4 py-3 text-sm ${
              feedback.kind === "error"
                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            {feedback.message}
          </p>
        ) : null}
      </form>

      {!token && mode === "reset" ? (
        <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          This reset link is missing its token. Request a fresh link.
        </p>
      ) : null}

      <p className="text-foreground/60 mt-6 text-center text-sm">
        <Link href="/login" className="text-primary font-semibold hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
