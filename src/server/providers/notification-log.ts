import "server-only";

import { connectToDatabase } from "@/server/db/connection";
import {
  NotificationLogModel,
  type NotificationChannel,
} from "@/server/db/models/notification-log";

interface DevelopmentLogEntry {
  to: string;
  channel: NotificationChannel;
  template: string;
  dedupeKey: string;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export async function logDevelopmentNotification(
  entry: DevelopmentLogEntry,
): Promise<boolean> {
  await connectToDatabase();

  try {
    await NotificationLogModel.create({
      ...entry,
      status: "SKIPPED",
      providerId: "development-console",
    });
    return true;
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      return false;
    }

    throw error;
  }
}
