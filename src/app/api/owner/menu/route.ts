import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { MenuModel, MENU_DAYS, MENU_MEALS } from "@/server/db/models/menu";
import { PgModel } from "@/server/db/models/pg";
import { weeklyMenuSchema } from "@/lib/ticket-schemas";

export async function GET() {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    await connectToDatabase();
    const menu = await MenuModel.findOne({ pgId }).lean();
    const emptyWeek = Object.fromEntries(MENU_DAYS.map((day) => [day, Object.fromEntries(MENU_MEALS.map((meal) => [meal, { items: [], isVeg: true }]))]));
    return Response.json({ week: menu?.week ?? emptyWeek });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Weekly menu could not be loaded" } }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const parsed = weeklyMenuSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Review the menu entries" } }, { status: 400 });
    await connectToDatabase();
    if (!await PgModel.exists({ _id: pgId, status: "ACTIVE" })) return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    const menu = await MenuModel.findOneAndUpdate(
      { pgId }, { $set: { week: parsed.data.week, updatedBy: user.id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    await AuditLogModel.create({ actorId: user.id, action: "WEEKLY_MENU_UPDATED", entity: "Menu", entityId: menu?._id, meta: { pgId } });
    return Response.json({ saved: true, week: menu?.week });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Weekly menu could not be saved" } }, { status: 500 });
  }
}
