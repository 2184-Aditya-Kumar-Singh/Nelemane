import { NextResponse } from "next/server";

import {
  authorizationErrorResponse,
  requireAuthenticatedUser,
} from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { writeAuditLog } from "@/server/auth/audit";
import { passwordChangeSchema } from "@/server/auth/schemas";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { UserModel } from "@/server/db/models/user";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json(
      { error: { code: "INVALID_ORIGIN", message: "Request origin is not allowed" } },
      { status: 403 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "The password is invalid",
        },
      },
      { status: 400 },
    );
  }

  try {
    const actor = await requireAuthenticatedUser();
    const user = await UserModel.findOne({ _id: actor.id, status: "ACTIVE" })
      .select("+passwordHash")
      .exec();

    if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return NextResponse.json(
        { error: { code: "CURRENT_PASSWORD_INVALID", message: "Current password is incorrect" } },
        { status: 400 },
      );
    }

    user.passwordHash = await hashPassword(parsed.data.newPassword);
    user.mustChangePassword = false;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    await writeAuditLog({
      actorId: user._id,
      entity: "User",
      entityId: user._id,
      action: "auth.password.change",
      meta: { forced: actor.mustChangePassword },
      ip: getRequestIp(request.headers),
    });

    return NextResponse.json({ message: "Password updated. Sign in again with your new password." });
  } catch (error) {
    const authError = authorizationErrorResponse(error);
    if (authError) {
      return authError;
    }

    throw error;
  }
}

function getRequestIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim();
  return ip?.slice(0, 64) || undefined;
}
