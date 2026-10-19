import { Types } from "mongoose";

import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { TenantModel } from "@/server/db/models/tenant";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { tenantId } = await context.params;
    if (!Types.ObjectId.isValid(tenantId)) return Response.json({ error: { message: "Aadhaar image was not found" } }, { status: 404 });
    await connectToDatabase();
    const tenant = await TenantModel.findOne({ _id: tenantId, pgId }).select("aadhaarCard").lean();
    if (!tenant?.aadhaarCard) return Response.json({ error: { message: "Aadhaar image was not found" } }, { status: 404 });
    const response = await privateImageResponse(tenant.aadhaarCard.publicId);
    if (!response.ok) return response;
    await AuditLogModel.create({ actorId: new Types.ObjectId(user.id), action: "TENANT_AADHAAR_VIEWED", entity: "Tenant", entityId: new Types.ObjectId(tenantId), meta: { pgId, access: "same-origin-image" } });
    return response;
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Aadhaar image could not be opened" } }, { status: 500 });
  }
}
