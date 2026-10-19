import { z } from "zod";

import { MENU_FOOD_TYPES, MENU_DAYS } from "@/lib/menu-types";

const menuItemSchema = z.object({
  name: z.string().trim().min(1, "Enter a dish name").max(80),
  foodType: z.enum(MENU_FOOD_TYPES),
  description: z.string().trim().max(240),
}).superRefine((item, context) => {
  if (item.foodType === "UNSPECIFIED") {
    context.addIssue({ code: "custom", path: ["foodType"], message: "Choose Veg or Non-veg for every dish" });
  }
});

const mealSchema = z.object({ items: z.array(menuItemSchema).max(12) });
const daySchema = z.object({
  breakfast: mealSchema,
  lunch: mealSchema,
  snacks: mealSchema,
  dinner: mealSchema,
});

export const weeklyMenuSchema = z.object({
  week: z.object(Object.fromEntries(MENU_DAYS.map((day) => [day, daySchema])) as Record<(typeof MENU_DAYS)[number], typeof daySchema>),
});
