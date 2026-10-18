import { Types } from "mongoose";

import { reportResolutionSchema } from "@/lib/pg-schemas";
import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AdminReportModel } from "@/server/db/models/admin-report";
import { AuditLogModel } from "@/server/db/models/audit-log";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const admin = await requireRoles("SUPER_ADMIN");
    const { reportId } = await context.params;
    if (!Types.ObjectId.isValid(reportId)) return Response.json({ error: { message: "Report was not found" } }, { status: 404 });
    const parsed = reportResolutionSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Resolution note is too long" } }, { status: 400 });
    await connectToDatabase();
    const report = await AdminReportModel.findOneAndUpdate(
      { _id: reportId, status: "OPEN" },
      { $set: { status: "RESOLVED", resolvedBy: admin.id, resolvedAt: new Date(), resolutionNote: parsed.data.note } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!report) return Response.json({ error: { message: "Report is already resolved or unavailable" } }, { status: 404 });
    await AuditLogModel.create({
      actorId: admin.id,
      action: "ADMIN_REPORT_RESOLVED",
      entity: "AdminReport",
      entityId: report._id,
      meta: { subject: report.subject },
    });
    return Response.json({ resolved: true, resolvedAt: report.resolvedAt?.toISOString() ?? new Date().toISOString() });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "Report could not be resolved" } }, { status: 500 });
  }
}
