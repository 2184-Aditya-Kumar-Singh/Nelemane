import { Types } from "mongoose";

import { reviewSchema } from "@/lib/ticket-schemas";
import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { ReviewModel } from "@/server/db/models/review";

export async function PUT(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const { user, tenant, pgId } = await requireActiveTenant();
    const parsed = reviewSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Choose a rating from 1 to 5" } }, { status: 400 });
    await connectToDatabase();
    await ReviewModel.findOneAndUpdate({ pgId, tenantId: tenant._id }, { $set: { rating: parsed.data.rating, comment: parsed.data.comment || undefined, editedAt: new Date() }, $setOnInsert: { pgId: new Types.ObjectId(pgId), tenantId: tenant._id } }, { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true });
    const [summary] = await ReviewModel.aggregate<{ average: number; count: number }>([
      { $match: { pgId: new Types.ObjectId(pgId) } },
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    await PgModel.updateOne({ _id: pgId }, { $set: { ratingAvg: summary?.average ?? 0, ratingCount: summary?.count ?? 0 } });
    await AuditLogModel.create({ actorId: user.id, action: "TENANT_REVIEW_SAVED", entity: "Review", meta: { pgId, rating: parsed.data.rating } });
    return Response.json({ saved: true, rating: parsed.data.rating, comment: parsed.data.comment || "" });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Review could not be saved" } }, { status: 500 });
  }
}
