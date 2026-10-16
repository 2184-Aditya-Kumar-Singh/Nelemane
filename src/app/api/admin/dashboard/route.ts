import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { AdminReportModel } from "@/server/db/models/admin-report";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { UserModel } from "@/server/db/models/user";

export async function GET() {
  try {
    await requireRoles("SUPER_ADMIN");
    await connectToDatabase();
    const now = new Date();
    const month = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [totalPgs, activeTenants, expiringSubscriptions, openReports, recentActivity] = await Promise.all([
      PgModel.countDocuments(),
      UserModel.countDocuments({ role: "TENANT", status: "ACTIVE" }),
      PgModel.countDocuments({ status: "ACTIVE", "subscription.status": "ACTIVE", "subscription.endsAt": { $gte: now, $lte: month } }),
      AdminReportModel.countDocuments({ status: "OPEN" }),
      AuditLogModel.find().sort({ createdAt: -1 }).limit(10).populate("actorId", "name email").lean(),
    ]);
    return Response.json({
      stats: { totalPgs, activeTenants, expiringSubscriptions, openReports },
      recentActivity: recentActivity.map((item) => {
        const populatedActor = item.actorId as unknown as { name?: unknown; email?: unknown } | null;
        const actor = populatedActor && typeof populatedActor.name === "string"
          ? { name: populatedActor.name, email: String(populatedActor.email ?? "") }
          : null;
        return {
          id: item._id.toString(),
          action: item.action,
          entity: item.entity,
          entityId: item.entityId?.toString() ?? null,
          actor,
          createdAt: item.createdAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "Dashboard data could not be loaded" } }, { status: 500 });
  }
}
