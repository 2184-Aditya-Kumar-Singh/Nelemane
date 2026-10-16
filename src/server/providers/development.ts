import "server-only";

import { APP_NAME } from "@/config/app";
import { getEnv } from "@/lib/env";
import type {
  EmailMessage,
  EmailProvider,
  SmsMessage,
  SmsProvider,
} from "@/server/providers/contracts";
import { LocalDevelopmentStorageProvider } from "@/server/providers/local-storage";
import { logDevelopmentNotification } from "@/server/providers/notification-log";

function assertDevelopmentMode(): void {
  if (getEnv().NODE_ENV === "production") {
    throw new Error(
      "Development provider fallbacks are disabled in production",
    );
  }
}

export function createDevelopmentEmailProvider(): EmailProvider {
  assertDevelopmentMode();

  return {
    async send(message: EmailMessage) {
      const logged = await logDevelopmentNotification({
        to: message.to,
        channel: "EMAIL",
        template: message.template,
        dedupeKey: message.dedupeKey,
      });

      if (logged) {
        console.info(`[${APP_NAME} development email]`, {
          to: message.to,
          template: message.template,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      }

      return { status: "SKIPPED", providerId: "development-console" };
    },
  };
}

export function createDevelopmentSmsProvider(): SmsProvider {
  assertDevelopmentMode();

  return {
    async send(message: SmsMessage) {
      const logged = await logDevelopmentNotification({
        to: message.to,
        channel: "SMS",
        template: message.template,
        dedupeKey: message.dedupeKey,
      });

      if (logged) {
        console.info(`[${APP_NAME} development SMS]`, {
          to: message.to,
          template: message.template,
          text: message.text,
        });
      }

      return { status: "SKIPPED", providerId: "development-console" };
    },
  };
}

export function createDevelopmentStorageProvider(): LocalDevelopmentStorageProvider {
  assertDevelopmentMode();
  return new LocalDevelopmentStorageProvider();
}

export function createDevelopmentProviders() {
  assertDevelopmentMode();
  return {
    email: createDevelopmentEmailProvider(),
    sms: createDevelopmentSmsProvider(),
    storage: createDevelopmentStorageProvider(),
  };
}
