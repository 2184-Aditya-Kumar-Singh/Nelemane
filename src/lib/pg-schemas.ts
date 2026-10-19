import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid upload reference");
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined);
const isoDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date").transform((value) => new Date(`${value}T00:00:00.000Z`));

const bankSchema = z.object({
  accountHolderName: z.string().trim().min(2).max(120),
  bankName: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().regex(/^\d{9,18}$/, "Enter a valid account number"),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code"),
  branch: optionalText(120),
});

const paymentQrAccountSchema = z.object({
  accountHolderName: z.string().trim().min(2).max(120),
  upiId: z.string().trim().max(100).regex(/^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9.-]{2,64}$/, "Enter a valid UPI ID"),
  qrAssetId: objectId,
});

export const pgRegistrationSchema = z.object({
  owner: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number"),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    profileAssetId: objectId.optional(),
  }),
  pg: z.object({
    name: z.string().trim().min(2).max(140),
    address: z.object({
      line1: z.string().trim().min(3).max(160),
      locality: z.string().trim().min(2).max(120),
      city: z.string().trim().min(2).max(100).default("Bengaluru"),
      state: z.string().trim().min(2).max(100).default("Karnataka"),
      pincode: z.string().trim().regex(/^\d{6}$/, "Enter a six-digit PIN code"),
      landmark: optionalText(160),
      mapsUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
    }),
    gstNumber: z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid GSTIN").optional().or(z.literal("")),
    nominee: z.object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/).optional().or(z.literal("")),
      relation: optionalText(80),
    }),
    profileAssetId: objectId.optional(),
  }),
  payment: z.object({
    accountType: z.enum(["BUSINESS", "PERSONAL"]),
    qrAccounts: z.array(paymentQrAccountSchema).max(5),
    bank: bankSchema.optional(),
    instructions: optionalText(1000),
  }).superRefine((value, context) => {
    if (!value.qrAccounts.length && !value.bank) {
      context.addIssue({ code: "custom", path: ["qrAccounts"], message: "Add a payment QR or bank details" });
    }
    if (value.accountType === "PERSONAL" && !value.qrAccounts.length) {
      context.addIssue({ code: "custom", path: ["qrAccounts"], message: "Personal accounts require a QR screenshot" });
    }
  }),
  subscription: z.object({
    planLabel: z.string().trim().min(2).max(80),
    startsAt: isoDate,
    endsAt: isoDate,
    notes: optionalText(1000),
  }).superRefine((value, context) => {
    if (value.endsAt <= value.startsAt) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "End date must be after the start date" });
    }
  }),
});

export type PgRegistrationInput = z.infer<typeof pgRegistrationSchema>;

export const pgAdminUpdateSchema = z.object({
  owner: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  }),
  name: z.string().trim().min(2).max(140),
  address: z.object({
    line1: z.string().trim().min(3).max(160),
    locality: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    pincode: z.string().trim().regex(/^\d{6}$/),
    landmark: optionalText(160),
    mapsUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  }),
  gstNumber: z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/).optional().or(z.literal("")),
  nominee: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/).optional().or(z.literal("")),
    relation: optionalText(80),
  }),
  subscription: z.object({
    planLabel: z.string().trim().min(2).max(80),
    startsAt: isoDate,
    endsAt: isoDate,
    notes: optionalText(1000),
  }).superRefine((value, context) => {
    if (value.endsAt <= value.startsAt) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "End date must be after the start date" });
    }
  }),
});

export const pgDeletionSchema = z.object({
  confirmName: z.string().trim().min(2).max(140),
  reason: z.string().trim().min(5).max(1000),
});

export const reportResolutionSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});
