import "server-only";

import { createHash } from "node:crypto";

import { connectToDatabase } from "@/server/db/connection";
import { LoginRateLimitModel } from "@/server/db/models/login-rate-limit";

export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function getRequestIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim();

  return candidate?.slice(0, 64) || "unknown";
}

export function createLoginRateKey(email: string, ip: string): string {
  return createRateLimitKey("login", email.toLowerCase(), ip);
}

export function createRateLimitKey(
  scope: string,
  subject: string,
  ip: string,
): string {
  return createHash("sha256")
    .update(`${scope}\n${subject}\n${ip}`)
    .digest("hex");
}

export async function consumeRateLimit(
  key: string,
  limit = LOGIN_FAILURE_LIMIT,
  now = new Date(),
): Promise<boolean> {
  return (await recordRateLimitHit(key, now)) <= limit;
}

export async function recordRateLimitHit(
  key: string,
  now = new Date(),
): Promise<number> {
  await connectToDatabase();

  const cutoff = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const expiredWindow = {
    $or: [
      { $eq: [{ $type: "$windowStartedAt" }, "missing"] },
      { $lte: ["$windowStartedAt", cutoff] },
    ],
  };
  const update = [
    {
      $set: {
        count: {
          $cond: [
            expiredWindow,
            1,
            { $add: [{ $ifNull: ["$count", 0] }, 1] },
          ],
        },
        windowStartedAt: {
          $cond: [expiredWindow, now, "$windowStartedAt"],
        },
        expiresAt: new Date(now.getTime() + LOGIN_WINDOW_MS),
        createdAt: { $ifNull: ["$createdAt", now] },
        updatedAt: now,
      },
    },
  ];

  try {
    const record = await LoginRateLimitModel.findOneAndUpdate(
      { key },
      update,
      { upsert: true, returnDocument: "after" },
    ).lean();
    if (!record) {
      throw new Error("Unable to update rate limit");
    }
    return record.count;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const record = await LoginRateLimitModel.findOneAndUpdate(
      { key },
      update,
      { returnDocument: "after" },
    ).lean();
    if (!record) {
      throw new Error("Unable to update rate limit");
    }
    return record.count;
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  await connectToDatabase();
  await LoginRateLimitModel.deleteOne({ key });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}
