import { createHash, randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { connectToDatabase } from "@/server/db/connection";
import { UserModel } from "@/server/db/models/user";
import { passwordResetRequestSchema } from "@/server/auth/schemas";
import { hasSameOrigin } from "@/server/auth/request-origin";
import {
  createRateLimitKey,
  consumeRateLimit,
  getRequestIp,
} from "@/server/auth/login-rate-limit";
import { sendPasswordResetEmail } from "@/server/auth/password-reset-email";

const GENERIC_MESSAGE =
  "If an active account matches that email, a password reset link will be sent.";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json(
      { error: { code: "INVALID_ORIGIN", message: "Request origin is not allowed" } },
      { status: 403 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = passwordResetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Enter a valid email address",
        },
      },
      { status: 400 },
    );
  }

  const rateKey = createRateLimitKey(
    "password-reset",
    parsed.data.email,
    getRequestIp(request.headers),
  );
  if (!(await consumeRateLimit(rateKey))) {
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  await connectToDatabase();
  const user = await UserModel.findOne({
    email: parsed.data.email,
    status: "ACTIVE",
  })
    .select("_id email")
    .lean();

  if (user) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await UserModel.updateOne(
      { _id: user._id, status: "ACTIVE" },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      },
    );

    try {
      await sendPasswordResetEmail(
        user.email,
        token,
        `password-reset:${user._id.toString()}:${tokenHash}`,
      );
    } catch {
      console.error("Nelemane could not deliver a password reset email.");
    }
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
