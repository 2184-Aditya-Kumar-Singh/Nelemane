import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { connectToDatabase } from "@/server/db/connection";
import { MenuModel, MENU_DAYS, MENU_MEALS } from "@/server/db/models/menu";
import { getIstMenuDay } from "@/server/menus/dates";

export async function GET() {
  try {
    const { pgId } = await requireActiveTenant();
    await connectToDatabase();
    const menu = await MenuModel.findOne({ pgId }).lean();
    const emptyWeek = Object.fromEntries(MENU_DAYS.map((day) => [day, Object.fromEntries(MENU_MEALS.map((meal) => [meal, { items: [], isVeg: true }]))]));
    const week = menu?.week ?? emptyWeek;
    const today = getIstMenuDay();
    return Response.json({ today, todayMenu: week[today], week });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Weekly menu could not be loaded" } }, { status: 500 });
  }
}
