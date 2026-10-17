import { Types } from "mongoose";

import { tenantReportSchema } from "@/lib/tenant-schemas";
import { escapeHtml } from "@/server/admin/serializers";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { getEnv } from "@/lib/env";
import { connectToDatabase } from "@/server/db/connection";
import { AdminReportModel } from "@/server/db/models/admin-report";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { TenantModel } from "@/server/db/models/tenant";
import { getEmailProvider } from "@/server/providers/email";

export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const { tenantId } = await context.params;
    if (!Types.ObjectId.isValid(tenantId)) return Response.json({ error: { message: "Tenant was not found" } }, { status: 404 });
    const parsed = tenantReportSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Add a subject and a short description", fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } }, { status: 400 });
    await connectToDatabase();
    const [tenant, pg] = await Promise.all([
      TenantModel.findOne({ _id: tenantId, pgId }).select("name email").lean(),
      PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name").lean(),
    ]);
    if (!tenant || !pg) return Response.json({ error: { message: "Tenant was not found" } }, { status: 404 });
    const report = await AdminReportModel.create({ fromUserId: new Types.ObjectId(user.id), pgId: new Types.ObjectId(pgId), tenantId: new Types.ObjectId(tenantId), subject: parsed.data.subject, message: `Tenant: ${tenant.name} (${tenant.email})\n\n${parsed.data.message}`, status: "OPEN" });
    await AuditLogModel.create({ actorId: new Types.ObjectId(user.id), action: "TENANT_ADMIN_REPORT_CREATED", entity: "AdminReport", entityId: report._id, meta: { pgId, tenantId } });
    let notificationStatus: "SENT" | "SKIPPED" | "FAILED" = "FAILED";
    const message = `PG owner ${user.name} reported an issue about ${tenant.name} at ${pg.name}: ${parsed.data.message}`;
    try {
      const result = await getEmailProvider().send({
        to: getEnv().ADMIN_EMAIL, template: "tenant-admin-report", dedupeKey: `tenant-admin-report-${report._id}`,
        subject: `Tenant report: ${parsed.data.subject}`,
        text: message,
        html: `<p>${escapeHtml(message)}</p>`,
      });
      notificationStatus = result.status;
    } catch { notificationStatus = "FAILED"; }
    return Response.json({ reportId: report._id.toString(), notificationStatus }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Admin report could not be sent" } }, { status: 500 });
  }
}
