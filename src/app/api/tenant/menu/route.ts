import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { connectToDatabase } from "@/server/db/connection";
import { MenuModel } from "@/server/db/models/menu";
import { normalizeMenuWeek } from "@/lib/menu-types";
import { getIstMenuDay } from "@/server/menus/dates";

export async function GET() {
  try {
    const { pgId } = await requireActiveTenant();
    await connectToDatabase();
    const menu = await MenuModel.findOne({ pgId }).lean();
    const week = normalizeMenuWeek(menu?.week);
    const today = getIstMenuDay();
    return Response.json({ today, todayMenu: week[today], week });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Weekly menu could not be loaded" } }, { status: 500 });
  }
}
