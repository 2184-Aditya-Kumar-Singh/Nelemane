import type { UserRole } from "@/server/db/models/user";

declare module "next-auth" {
  interface User {
    role: UserRole;
    pgId: string | null;
    mustChangePassword: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      pgId: string | null;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    pgId?: string | null;
    mustChangePassword?: boolean;
  }
}

import type { DefaultSession } from "next-auth";
