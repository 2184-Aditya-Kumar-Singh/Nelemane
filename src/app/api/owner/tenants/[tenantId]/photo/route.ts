import { Types } from "mongoose";

import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { TenantModel } from "@/server/db/models/tenant";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { tenantId } = await context.params;
    if (!Types.ObjectId.isValid(tenantId)) return Response.json({ error: { message: "Profile photo was not found" } }, { status: 404 });
    await connectToDatabase();
    const tenant = await TenantModel.findOne({ _id: tenantId, pgId }).select("profilePhoto").lean();
    if (!tenant?.profilePhoto) return Response.json({ error: { message: "Profile photo was not found" } }, { status: 404 });
    return privateImageResponse(tenant.profilePhoto.publicId);
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Profile photo could not be opened" } }, { status: 500 });
  }
}
