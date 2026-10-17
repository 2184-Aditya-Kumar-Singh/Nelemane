import "server-only";

import type { DeliveryResult, EmailMessage, SmsMessage } from "@/server/providers/contracts";
import { connectToDatabase } from "@/server/db/connection";
import { NotificationLogModel, type NotificationChannel } from "@/server/db/models/notification-log";
import { getEmailProvider } from "@/server/providers/email";
import { getSmsProvider } from "@/server/providers/sms";

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function claimNotification(input: { to: string; channel: NotificationChannel; template: string; dedupeKey: string }): Promise<boolean> {
  await connectToDatabase();
  try {
    await NotificationLogModel.create({ ...input, status: "SENDING" });
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
}

async function finishNotification(dedupeKey: string, result: DeliveryResult): Promise<void> {
  await NotificationLogModel.updateOne(
    { dedupeKey, status: "SENDING" },
    { $set: { status: result.status, providerId: result.providerId, error: result.status === "FAILED" ? "Delivery failed" : undefined } },
  );
}

export async function sendEmailOnce(message: EmailMessage): Promise<DeliveryResult> {
  const claimed = await claimNotification({ to: message.to, channel: "EMAIL", template: message.template, dedupeKey: message.dedupeKey });
  if (!claimed) return { status: "SKIPPED", providerId: "duplicate-suppressed" };
  try {
    const result = await getEmailProvider().send(message);
    await finishNotification(message.dedupeKey, result);
    return result;
  } catch {
    const result = { status: "FAILED" as const, providerId: "email" };
    await finishNotification(message.dedupeKey, result).catch(() => undefined);
    return result;
  }
}

export async function sendSmsOnce(message: SmsMessage): Promise<DeliveryResult> {
  const claimed = await claimNotification({ to: message.to, channel: "SMS", template: message.template, dedupeKey: message.dedupeKey });
  if (!claimed) return { status: "SKIPPED", providerId: "duplicate-suppressed" };
  try {
    const result = await getSmsProvider().send(message);
    await finishNotification(message.dedupeKey, result);
    return result;
  } catch {
    const result = { status: "FAILED" as const, providerId: "sms" };
    await finishNotification(message.dedupeKey, result).catch(() => undefined);
    return result;
  }
}
