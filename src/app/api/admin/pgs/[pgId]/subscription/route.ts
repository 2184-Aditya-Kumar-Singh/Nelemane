import { Types } from "mongoose";
import { z } from "zod";

import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";

const actionSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ pgId: string }> },
) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const admin = await requireRoles("SUPER_ADMIN");
    const { pgId } = await context.params;
    if (!Types.ObjectId.isValid(pgId)) return Response.json({ error: { message: "PG was not found" } }, { status: 404 });
    const parsed = actionSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Subscription status is invalid" } }, { status: 400 });
    await connectToDatabase();
    const pg = await PgModel.findOneAndUpdate(
      { _id: pgId, status: "ACTIVE", "subscription.status": { $ne: "CANCELLED" } },
      {
        $set: {
          "subscription.status": parsed.data.status,
          isListed: parsed.data.status === "ACTIVE",
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!pg) return Response.json({ error: { message: "This PG cannot change subscription status" } }, { status: 404 });

    await AuditLogModel.create({
      actorId: admin.id,
      action: parsed.data.status === "SUSPENDED" ? "PG_SUBSCRIPTION_SUSPENDED" : "PG_SUBSCRIPTION_REACTIVATED",
      entity: "PG",
      entityId: pg._id,
      meta: { name: pg.name, status: parsed.data.status },
    });
    return Response.json({ status: parsed.data.status, isListed: pg.isListed });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "Subscription could not be updated" } }, { status: 500 });
  }
}
