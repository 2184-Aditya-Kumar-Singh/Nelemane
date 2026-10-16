import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { writeAuditLog } from "@/server/auth/audit";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { hashPassword } from "@/server/auth/password";
import { passwordResetSchema } from "@/server/auth/schemas";
import { connectToDatabase } from "@/server/db/connection";
import { UserModel } from "@/server/db/models/user";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json(
      { error: { code: "INVALID_ORIGIN", message: "Request origin is not allowed" } },
      { status: 403 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = passwordResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "The reset details are invalid",
        },
      },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const passwordHash = await hashPassword(parsed.data.newPassword);
  const user = await UserModel.findOneAndUpdate(
    {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
      status: "ACTIVE",
    },
    {
      $set: { passwordHash, mustChangePassword: false },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    },
    { new: true },
  )
    .select("_id")
    .lean();

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: "RESET_LINK_INVALID",
          message: "This reset link is invalid or has expired. Request a new one.",
        },
      },
      { status: 400 },
    );
  }

  await writeAuditLog({
    actorId: user._id,
    entity: "User",
    entityId: user._id,
    action: "auth.password.reset",
    meta: { method: "email-token" },
    ip: getRequestIp(request.headers),
  });

  return NextResponse.json({ message: "Password updated. You can now sign in." });
}

function getRequestIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim();
  return ip?.slice(0, 64) || undefined;
}
