export const MENU_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const MENU_MEALS = ["breakfast", "lunch", "snacks", "dinner"] as const;
export const MENU_FOOD_TYPES = ["VEG", "NON_VEG", "UNSPECIFIED"] as const;

export type MenuDay = (typeof MENU_DAYS)[number];
export type MenuMeal = (typeof MENU_MEALS)[number];
export type MenuFoodType = (typeof MENU_FOOD_TYPES)[number];

export interface MenuItemRecord {
  name: string;
  foodType: MenuFoodType;
  description: string;
}

export interface MenuMealRecord {
  items: MenuItemRecord[];
}

export type MenuDayRecord = Record<MenuMeal, MenuMealRecord>;
export type MenuWeekRecord = Record<MenuDay, MenuDayRecord>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Converts both current menu data and the old string-item format into the
 * display format. Legacy meal-level veg flags are intentionally not applied:
 * a mixed meal cannot be classified accurately from one flag.
 */
export function normalizeMenuWeek(value: unknown): MenuWeekRecord {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(MENU_DAYS.map((day) => {
    const rawDay = isRecord(source[day]) ? source[day] as Record<string, unknown> : {};
    const normalizedMeals = Object.fromEntries(MENU_MEALS.map((meal) => {
      const rawMeal = isRecord(rawDay[meal]) ? rawDay[meal] as Record<string, unknown> : {};
      const rawItems = Array.isArray(rawMeal.items) ? rawMeal.items : [];
      const items = rawItems.flatMap((rawItem): MenuItemRecord[] => {
        if (typeof rawItem === "string") {
          const name = rawItem.trim();
          return name ? [{ name, foodType: "UNSPECIFIED", description: "" }] : [];
        }
        if (!isRecord(rawItem) || typeof rawItem.name !== "string") return [];
        const name = rawItem.name.trim();
        if (!name) return [];
        const foodType = rawItem.foodType === "EGG"
          ? "NON_VEG"
          : MENU_FOOD_TYPES.includes(rawItem.foodType as MenuFoodType)
            ? rawItem.foodType as MenuFoodType
            : "UNSPECIFIED";
        return [{
          name,
          foodType,
          description: typeof rawItem.description === "string" ? rawItem.description.trim() : "",
        }];
      });
      return [meal, { items }];
    }));
    return [day, normalizedMeals];
  })) as MenuWeekRecord;
}
