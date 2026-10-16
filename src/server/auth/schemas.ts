import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(254)
  .transform((value) => value.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const newPasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128, "Password must be 128 characters or fewer");

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: newPasswordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "Choose a password different from your current password",
  });

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const passwordResetSchema = z.object({
  token: z.string().min(32).max(128),
  newPassword: newPasswordSchema,
});
