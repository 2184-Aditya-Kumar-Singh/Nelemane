import "server-only";

import { Types } from "mongoose";

import { auth } from "@/auth";
import { connectToDatabase } from "@/server/db/connection";
import { UserModel, type UserRole } from "@/server/db/models/user";

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  pgId: string | null;
  mustChangePassword: boolean;
  email: string;
  name: string;
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const session = await auth();
  const sessionId = session?.user?.id;

  if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
    throw new AuthorizationError("Sign in is required", 401);
  }

  await connectToDatabase();
  const user = await UserModel.findOne({ _id: sessionId, status: "ACTIVE" })
    .select("_id role pgId mustChangePassword email name")
    .lean();

  if (!user) {
    throw new AuthorizationError("This account is not available", 401);
  }

  return {
    id: user._id.toString(),
    role: user.role,
    pgId: user.pgId?.toString() ?? null,
    mustChangePassword: user.mustChangePassword,
    email: user.email,
    name: user.name,
  };
}

export async function requireRoles(
  ...roles: UserRole[]
): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();

  if (!roles.includes(user.role)) {
    throw new AuthorizationError("You do not have access to this resource", 403);
  }

  return user;
}

export function requirePgScope(user: AuthenticatedUser): string {
  if (user.role === "SUPER_ADMIN" || !user.pgId) {
    throw new AuthorizationError("A PG account is required", 403);
  }

  return user.pgId;
}

export function assertSamePg(
  user: AuthenticatedUser,
  requestedPgId: string,
): void {
  if (user.role !== "SUPER_ADMIN" && user.pgId !== requestedPgId) {
    throw new AuthorizationError("You do not have access to this PG", 403);
  }
}

export function authorizationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AuthorizationError)) {
    return null;
  }

  return Response.json(
    { error: { code: error.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", message: error.message } },
    { status: error.status },
  );
}
