import { z } from "zod";

import { ownerPhotoReferenceSchema } from "@/lib/owner-schemas";

const phone = z.string().trim().regex(/^(?:\+91[ -]?)?[6-9]\d{9}$/, "Enter a valid Indian phone number");
const optionalPhone = z.string().trim().max(20).optional().or(z.literal("")).refine((value) => !value || /^(?:\+91[ -]?)?[6-9]\d{9}$/.test(value), "Enter a valid Indian phone number");

export const tenantInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone,
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  roomId: z.string().regex(/^[a-f\d]{24}$/i),
  monthlyRentPaise: z.number().int().min(0).max(100_000_000),
  depositPaise: z.number().int().min(0).max(1_000_000_000),
  joinedAt: z.string().date(),
  parents: z.object({
    fatherName: z.string().trim().min(2).max(120),
    motherName: z.string().trim().max(120).optional().or(z.literal("")),
    phone,
    alternatePhone: optionalPhone,
  }),
  profilePhoto: ownerPhotoReferenceSchema.nullable().optional(),
  aadhaarPhoto: ownerPhotoReferenceSchema.nullable().optional(),
  aadhaarConsent: z.boolean(),
  sendCredentialsNow: z.boolean(),
}).superRefine((value, context) => {
  if (value.aadhaarPhoto && !value.aadhaarConsent) {
    context.addIssue({ code: "custom", path: ["aadhaarConsent"], message: "Consent is required before storing the Aadhaar image" });
  }
});

export const tenantRemovalSchema = z.object({
  confirmName: z.string().trim().min(2).max(120),
  deleteAadhaarNow: z.boolean(),
});

export const tenantReportSchema = z.object({
  subject: z.string().trim().min(4).max(180),
  message: z.string().trim().min(10).max(5000),
});
