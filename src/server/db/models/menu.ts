import mongoose, { type Model, type Types } from "mongoose";
import { MENU_DAYS, MENU_MEALS, type MenuDayRecord, type MenuWeekRecord } from "@/lib/menu-types";

export { MENU_DAYS, MENU_MEALS };
export type { MenuDay, MenuMeal, MenuDayRecord, MenuMealRecord } from "@/lib/menu-types";

const { model, models, Schema } = mongoose;

export interface MenuRecord {
  pgId: Types.ObjectId;
  week: MenuWeekRecord;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<MenuWeekRecord["mon"]["breakfast"]["items"][number]>({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  foodType: { type: String, enum: ["VEG", "NON_VEG", "UNSPECIFIED"], required: true, default: "UNSPECIFIED" },
  description: { type: String, trim: true, maxlength: 240, default: "" },
}, { _id: false });
const mealSchema = new Schema<MenuWeekRecord["mon"]["breakfast"]>({
  items: { type: [itemSchema], default: [], validate: (items: unknown[]) => items.length <= 12 },
}, { _id: false });
const daySchema = new Schema<MenuDayRecord>({
  breakfast: { type: mealSchema, default: () => ({ items: [] }) },
  lunch: { type: mealSchema, default: () => ({ items: [] }) },
  snacks: { type: mealSchema, default: () => ({ items: [] }) },
  dinner: { type: mealSchema, default: () => ({ items: [] }) },
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
