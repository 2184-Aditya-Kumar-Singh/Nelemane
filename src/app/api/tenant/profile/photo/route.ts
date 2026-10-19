import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { privateImageResponse } from "@/server/providers/private-image-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { tenant } = await requireActiveTenant();
    if (!tenant.profilePhoto) return Response.json({ error: { message: "Profile photo was not found" } }, { status: 404 });
    return privateImageResponse(tenant.profilePhoto.publicId);
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Profile photo could not be opened" } }, { status: 500 });
  }
}
