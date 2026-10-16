import { NextResponse } from "next/server";

import { auth } from "@/auth";

const roleByPath: Record<string, "SUPER_ADMIN" | "PG_OWNER" | "TENANT"> = {
  admin: "SUPER_ADMIN",
  owner: "PG_OWNER",
  tenant: "TENANT",
};

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const user = request.auth?.user;
  const isApi = pathname.startsWith("/api/");

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return isApi
      ? Response.json(
          { error: { code: "UNAUTHENTICATED", message: "Sign in is required" } },
          { status: 401 },
        )
      : NextResponse.redirect(loginUrl);
  }

  if (user.mustChangePassword && pathname !== "/change-password") {
    return isApi
      ? Response.json(
          {
            error: {
              code: "PASSWORD_CHANGE_REQUIRED",
              message: "Change your temporary password to continue",
            },
          },
          { status: 403 },
        )
      : NextResponse.redirect(new URL("/change-password", request.url));
  }

  const section = pathname.split("/")[1];
  const requiredRole = roleByPath[section];
  if (requiredRole && user.role !== requiredRole) {
    return isApi
      ? Response.json(
          { error: { code: "FORBIDDEN", message: "You do not have access to this resource" } },
          { status: 403 },
        )
      : NextResponse.redirect(new URL("/dashboard?denied=1", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/owner/:path*",
    "/tenant/:path*",
    "/dashboard",
    "/change-password",
    "/api/admin/:path*",
    "/api/owner/:path*",
    "/api/tenant/:path*",
  ],
};
