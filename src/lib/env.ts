import "server-only";

import { Buffer } from "node:buffer";
import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown =>
  value === "" || value === null ? undefined : value;

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const optionalSecret = z.preprocess(
  emptyToUndefined,
  z.string().min(32).optional(),
);

const optionalPort = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(65535).optional(),
);

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32),
    NEXTAUTH_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    NEXTAUTH_SECRET: optionalSecret,
    MONGODB_URI: z
      .string()
      .min(1)
      .refine(
        (value) =>
          value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
        "Must be a MongoDB connection string",
      ),
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
    RESEND_API_KEY: optionalString,
    MSG91_AUTH_KEY: optionalString,
    MSG91_SENDER_ID: optionalString,
    MSG91_TEMPLATE_ID: optionalString,
    CRON_SECRET: z.string().min(32),
    DATA_ENCRYPTION_KEY: z.string().min(1),
    ADMIN_EMAIL: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    ADMIN_INITIAL_PASSWORD: z.string().min(12),
    SMTP_HOST: optionalString,
    SMTP_PORT: optionalPort,
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    EMAIL_FROM: optionalString,
  })
  .superRefine((values, context) => {
    const cloudinarySettings = [
      values.CLOUDINARY_CLOUD_NAME,
      values.CLOUDINARY_API_KEY,
      values.CLOUDINARY_API_SECRET,
    ];
    const hasSomeCloudinarySettings = cloudinarySettings.some(Boolean);
    const hasAllCloudinarySettings = cloudinarySettings.every(Boolean);

    if (hasSomeCloudinarySettings && !hasAllCloudinarySettings) {
      context.addIssue({
        code: "custom",
        path: ["CLOUDINARY_CLOUD_NAME"],
        message: "Set all Cloudinary variables or leave all of them blank",
      });
    }

    const smtpSettings = [
      values.SMTP_HOST,
      values.SMTP_PORT,
      values.SMTP_USER,
      values.SMTP_PASS,
      values.EMAIL_FROM,
    ];
    const hasSomeSmtpSettings = smtpSettings.some(Boolean);
    const hasAllSmtpSettings = smtpSettings.every(Boolean);

    if (hasSomeSmtpSettings && !hasAllSmtpSettings && !values.RESEND_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "Set all SMTP variables or configure RESEND_API_KEY",
      });
    }

    if (
      values.NEXTAUTH_SECRET &&
      values.NEXTAUTH_SECRET !== values.AUTH_SECRET
    ) {
      context.addIssue({
        code: "custom",
        path: ["NEXTAUTH_SECRET"],
        message: "Must match AUTH_SECRET",
      });
    }

    const encryptionKey = Buffer.from(values.DATA_ENCRYPTION_KEY, "base64");
    if (
      encryptionKey.byteLength !== 32 ||
      encryptionKey.toString("base64") !== values.DATA_ENCRYPTION_KEY
    ) {
      context.addIssue({
        code: "custom",
        path: ["DATA_ENCRYPTION_KEY"],
        message: "Must be a valid base64-encoded 32-byte key",
      });
    }

    if (values.NODE_ENV === "production") {
      if (!hasAllCloudinarySettings) {
        context.addIssue({
          code: "custom",
          path: ["CLOUDINARY_CLOUD_NAME"],
          message: "Cloudinary must be configured in production",
        });
      }

      if (
        !values.EMAIL_FROM ||
        (!values.RESEND_API_KEY && !hasAllSmtpSettings)
      ) {
        context.addIssue({
          code: "custom",
          path: ["RESEND_API_KEY"],
          message: "Configure Resend or complete SMTP settings in production",
        });
      }
    }
  });

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function getEnv(): AppEnvironment {
  const result = environmentSchema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
