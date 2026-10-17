import "server-only";

import { consumeRateLimit, createRateLimitKey } from "@/server/auth/login-rate-limit";

export const UPLOAD_LIMIT_PER_WINDOW = 25;

export async function consumeUploadRateLimit(input: { scope: "admin" | "owner" | "tenant"; userId: string }): Promise<boolean> {
  const key = createRateLimitKey(`upload-${input.scope}`, input.userId, "authenticated-account");
  return consumeRateLimit(key, UPLOAD_LIMIT_PER_WINDOW);
}
