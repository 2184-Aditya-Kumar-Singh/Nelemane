import "server-only";

import { AuthorizationError, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { TenantModel } from "@/server/db/models/tenant";

export async function requireActiveTenant() {
  const user = await requireRoles("TENANT");
  const pgId = requirePgScope(user);
  await connectToDatabase();
  const tenant = await TenantModel.findOne({ userId: user.id, pgId, status: "ACTIVE" });
  if (!tenant) throw new AuthorizationError("Your tenant profile is not available", 403);
  return { user, pgId, tenant };
}
