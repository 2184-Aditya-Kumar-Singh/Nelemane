import { z } from "zod";

import { ownerPhotoReferenceSchema } from "@/lib/owner-schemas";

const transactionId = z.string().trim().regex(/^[A-Za-z0-9]{8,35}$/, "Enter an 8–35 character alphanumeric transaction ID or UTR").transform((value) => value.toUpperCase());
const date = z.string().date();

export const tenantPaymentInputSchema = z.object({
  chargeId: z.string().regex(/^[a-f\d]{24}$/i),
  transactionId,
  transactionDate: date,
  amountPaise: z.number().int().min(1).max(1_000_000_000),
  payerName: z.string().trim().min(2).max(120),
  mode: z.enum(["UPI", "BANK_TRANSFER", "OTHER"]),
  screenshot: ownerPhotoReferenceSchema,
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const ownerRecordPaymentSchema = z.object({
  tenantId: z.string().regex(/^[a-f\d]{24}$/i),
  chargeId: z.string().regex(/^[a-f\d]{24}$/i),
  transactionId: transactionId.optional().or(z.literal("")),
  transactionDate: date,
  amountPaise: z.number().int().min(1).max(1_000_000_000),
  payerName: z.string().trim().min(2).max(120),
  mode: z.enum(["UPI", "BANK_TRANSFER", "CASH"]),
  screenshot: ownerPhotoReferenceSchema.nullable().optional(),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
}).superRefine((value, context) => {
  if (value.mode !== "CASH" && !value.transactionId) context.addIssue({ code: "custom", path: ["transactionId"], message: "A transaction ID is required for bank and UPI payments" });
});

export const paymentApprovalSchema = z.object({ approvedAmountPaise: z.number().int().min(1).max(1_000_000_000) });
export const paymentRejectionSchema = z.object({ reason: z.string().trim().min(5).max(1000) });
