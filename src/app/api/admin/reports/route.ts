import { z } from "zod";

import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { AdminReportModel } from "@/server/db/models/admin-report";

const statusSchema = z.enum(["OPEN", "RESOLVED"]);

export async function GET(request: Request) {
  try {
    await requireRoles("SUPER_ADMIN");
    await connectToDatabase();
    const statusResult = statusSchema.safeParse(new URL(request.url).searchParams.get("status") ?? "OPEN");
    const status = statusResult.success ? statusResult.data : undefined;
    const reports = await AdminReportModel.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("fromUserId", "name email role")
      .populate("pgId", "name slug")
      .populate("resolvedBy", "name email")
      .lean();
    return Response.json({ reports: reports.map((report) => ({
      id: report._id.toString(),
      subject: report.subject,
      message: report.message,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      resolutionNote: report.resolutionNote ?? "",
      fromUser: (() => {
        const user = report.fromUserId as unknown as { _id?: { toString(): string }; name?: unknown; email?: unknown; role?: unknown } | null;
        return user && typeof user.name === "string"
          ? { id: user._id?.toString() ?? "", name: user.name, email: String(user.email ?? ""), role: String(user.role ?? "") }
          : null;
      })(),
      pg: (() => {
        const pg = report.pgId as unknown as { _id?: { toString(): string }; name?: unknown; slug?: unknown } | null;
        return pg && typeof pg.name === "string"
          ? { id: pg._id?.toString() ?? "", name: pg.name, slug: String(pg.slug ?? "") }
          : null;
      })(),
      resolvedBy: (() => {
        const user = report.resolvedBy as unknown as { name?: unknown; email?: unknown } | null;
        return user && typeof user.name === "string"
          ? { name: user.name, email: String(user.email ?? "") }
          : null;
      })(),
    })) });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "Reports could not be loaded" } }, { status: 500 });
  }
}
