import { model, models, Schema, type Model, type Types } from "mongoose";

export const MENU_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const MENU_MEALS = ["breakfast", "lunch", "snacks", "dinner"] as const;
export type MenuDay = (typeof MENU_DAYS)[number];
export type MenuMeal = (typeof MENU_MEALS)[number];

export interface MenuMealRecord {
  items: string[];
  isVeg: boolean;
}

export type MenuDayRecord = Record<MenuMeal, MenuMealRecord>;
export interface MenuRecord {
  pgId: Types.ObjectId;
  week: Record<MenuDay, MenuDayRecord>;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const mealSchema = new Schema<MenuMealRecord>({
  items: { type: [String], default: [], validate: (items: string[]) => items.length <= 12 },
  isVeg: { type: Boolean, required: true, default: true },
}, { _id: false });
const daySchema = new Schema<MenuDayRecord>({
  breakfast: { type: mealSchema, default: () => ({ items: [], isVeg: true }) },
  lunch: { type: mealSchema, default: () => ({ items: [], isVeg: true }) },
  snacks: { type: mealSchema, default: () => ({ items: [], isVeg: true }) },
  dinner: { type: mealSchema, default: () => ({ items: [], isVeg: true }) },
}, { _id: false });

const menuSchema = new Schema<MenuRecord>({
  pgId: { type: Schema.Types.ObjectId, ref: "PG", required: true },
  week: {
    mon: { type: daySchema, default: () => ({}) }, tue: { type: daySchema, default: () => ({}) },
    wed: { type: daySchema, default: () => ({}) }, thu: { type: daySchema, default: () => ({}) },
    fri: { type: daySchema, default: () => ({}) }, sat: { type: daySchema, default: () => ({}) },
    sun: { type: daySchema, default: () => ({}) },
  },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

menuSchema.index({ pgId: 1 }, { unique: true, name: "menu_pg_unique" });

export const MenuModel = (models.Menu as Model<MenuRecord> | undefined) ?? model<MenuRecord>("Menu", menuSchema);
