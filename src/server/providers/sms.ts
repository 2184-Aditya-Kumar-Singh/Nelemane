import "server-only";

import { getEnv } from "@/lib/env";
import type { DeliveryResult, SmsMessage, SmsProvider } from "@/server/providers/contracts";
import { createDevelopmentSmsProvider } from "@/server/providers/development";
import { connectToDatabase } from "@/server/db/connection";
import { NotificationLogModel } from "@/server/db/models/notification-log";

let provider: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  provider ??= createSmsProvider();
  return provider;
}

function createSmsProvider(): SmsProvider {
  const env = getEnv();
  const authKey = env.MSG91_AUTH_KEY;
  const templateId = env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) {
    if (env.NODE_ENV === "production") {
      return { async send() { return { status: "SKIPPED", providerId: "sms-not-configured" }; } };
    }
    return createDevelopmentSmsProvider();
  }

  return {
    async send(message: SmsMessage): Promise<DeliveryResult> {
      const mobile = message.to.replace(/[^\d]/g, "");
      const internationalMobile = mobile.length === 10 ? `91${mobile}` : mobile;
      if (!/^\d{11,15}$/.test(internationalMobile)) {
        await recordSmsDelivery(message, { status: "FAILED", providerId: "invalid-mobile" });
        throw new Error("SMS destination is invalid");
      }

      let response: Response;
      try {
        response = await fetch("https://control.msg91.com/api/v5/flow", {
          method: "POST",
          headers: {
            accept: "application/json",
            authkey: authKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            template_id: templateId,
            recipients: [{ mobiles: internationalMobile, VAR1: message.text.slice(0, 400) }],
          }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        await recordSmsDelivery(message, { status: "FAILED", providerId: "msg91" });
        throw new Error("SMS delivery failed");
      }

      const payload = await response.json().catch(() => ({})) as {
        type?: string;
        request_id?: string;
      };
      if (!response.ok || payload.type?.toLowerCase() === "error") {
        await recordSmsDelivery(message, { status: "FAILED", providerId: "msg91" });
        throw new Error("SMS delivery failed");
      }

      const result: DeliveryResult = {
        status: "SENT",
        providerId: payload.request_id ?? "msg91",
      };
      await recordSmsDelivery(message, result);
      return result;
    },
  };
}

async function recordSmsDelivery(
  message: SmsMessage,
  result: DeliveryResult,
): Promise<void> {
  await connectToDatabase();
  try {
    await NotificationLogModel.create({
      to: message.to,
      channel: "SMS",
      template: message.template,
      status: result.status,
      providerId: result.providerId,
      dedupeKey: message.dedupeKey,
    });
  } catch (error: unknown) {
    if (!isDuplicateKeyError(error)) throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
