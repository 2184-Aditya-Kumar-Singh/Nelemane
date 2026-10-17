import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const categories = ["ELECTRICAL", "PLUMBING", "WIFI", "CLEANING", "FOOD", "FURNITURE", "OTHER"] as const;
const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export const ticketCreateSchema = z.object({
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(categories),
  priority: z.enum(priorities).default("NORMAL"),
  imageAssetIds: z.array(objectId).max(5).default([]),
});

export const ticketProgressSchema = z.object({ action: z.literal("IN_PROGRESS") });
export const ticketResolutionSchema = z.object({
  action: z.literal("RESOLVE"),
  note: z.string().trim().min(5).max(2000),
  imageAssetIds: z.array(objectId).min(1).max(5),
});

export const ticketFeedbackSchema = z.object({
  approved: z.boolean(),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
  token: z.string().min(32).max(200).optional(),
}).superRefine((value, context) => {
  if (!value.approved && !value.comment?.trim()) {
    context.addIssue({ code: "custom", path: ["comment"], message: "Explain what still needs fixing" });
  }
});

const mealSchema = z.object({ items: z.array(z.string().trim().min(1).max(80)).max(12), isVeg: z.boolean() });
const daySchema = z.object({ breakfast: mealSchema, lunch: mealSchema, snacks: mealSchema, dinner: mealSchema });
export const weeklyMenuSchema = z.object({
  week: z.object({ mon: daySchema, tue: daySchema, wed: daySchema, thu: daySchema, fri: daySchema, sat: daySchema, sun: daySchema }),
});

export const tenantProfileSchema = z.object({
  phone: z.string().trim().min(7).max(20),
  profilePhotoAssetId: objectId.nullable().optional(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});
