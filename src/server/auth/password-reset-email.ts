import "server-only";

import { APP_NAME } from "@/config/app";
import { getEnv } from "@/lib/env";
import type { EmailMessage } from "@/server/providers/contracts";
import { getEmailProvider } from "@/server/providers/email";

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  dedupeKey: string,
): Promise<void> {
  const resetUrl = new URL("/reset-password", getEnv().APP_URL);
  resetUrl.searchParams.set("token", token);
  const safeUrl = escapeHtml(resetUrl.toString());

  const message: EmailMessage = {
    to,
    template: "password-reset",
    dedupeKey,
    subject: `Reset your ${APP_NAME} password`,
    text: `We received a request to reset your ${APP_NAME} password. Use this single-use link within 30 minutes: ${resetUrl.toString()} If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#211f3f"><h1 style="font-size:24px">Reset your ${APP_NAME} password</h1><p>Use this single-use link within 30 minutes to choose a new password.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#1e1b4b;color:#fff;text-decoration:none">Reset password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
  };

  await getEmailProvider().send(message);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
