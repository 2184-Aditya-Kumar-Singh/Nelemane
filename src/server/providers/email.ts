import "server-only";

import nodemailer from "nodemailer";
import { Resend } from "resend";

import { getEnv } from "@/lib/env";
import type {
  DeliveryResult,
  EmailMessage,
  EmailProvider,
} from "@/server/providers/contracts";
import { createDevelopmentEmailProvider } from "@/server/providers/development";
import { connectToDatabase } from "@/server/db/connection";
import { NotificationLogModel } from "@/server/db/models/notification-log";

let cachedProvider: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  cachedProvider ??= createEmailProvider();
  return cachedProvider;
}

function createEmailProvider(): EmailProvider {
  const env = getEnv();
  const hasSmtpSettings = Boolean(
    env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM,
  );
  if (env.NODE_ENV !== "production" && !env.RESEND_API_KEY && !hasSmtpSettings) {
    return createDevelopmentEmailProvider();
  }

  const emailFrom = env.EMAIL_FROM;
  if (!emailFrom) {
    throw new Error("Email delivery requires EMAIL_FROM in production");
  }

  if (env.RESEND_API_KEY) {
    const resend = new Resend(env.RESEND_API_KEY);
    return {
      async send(message) {
        try {
          const response = await resend.emails.send({
            from: emailFrom,
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
            tags: [{ name: "template", value: message.template }],
          });

          if (response.error) {
            throw new Error("Email delivery failed");
          }

          const result: DeliveryResult = {
            status: "SENT",
            providerId: response.data?.id,
          };
          await recordEmailDelivery(message, result);
          return result;
        } catch {
          await recordEmailDelivery(message, {
            status: "FAILED",
            providerId: "resend",
          });
          throw new Error("Email delivery failed");
        }
      },
    };
  }

  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error("Email delivery requires complete SMTP settings");
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  return {
    async send(message) {
      try {
        const response = await transport.sendMail({
          from: emailFrom,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          headers: { "X-Nelemane-Template": message.template },
        });
        const result: DeliveryResult = {
          status: "SENT",
          providerId: response.messageId,
        };
        await recordEmailDelivery(message, result);
        return result;
      } catch {
        await recordEmailDelivery(message, {
          status: "FAILED",
          providerId: "smtp",
        });
        throw new Error("Email delivery failed");
      }
    },
  };
}

async function recordEmailDelivery(
  message: EmailMessage,
  result: DeliveryResult,
): Promise<void> {
  await connectToDatabase();

  try {
    await NotificationLogModel.create({
      to: message.to,
      channel: "EMAIL",
      template: message.template,
      status: result.status,
      providerId: result.providerId,
      dedupeKey: message.dedupeKey,
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}
