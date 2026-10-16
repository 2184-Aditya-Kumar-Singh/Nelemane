import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { loginSchema } from "@/server/auth/schemas";
import { writeAuditLog } from "@/server/auth/audit";
import {
  clearRateLimit,
  createLoginRateKey,
  consumeRateLimit,
  getRequestIp,
} from "@/server/auth/login-rate-limit";
import { verifyPassword } from "@/server/auth/password";
import { connectToDatabase } from "@/server/db/connection";
import { UserModel } from "@/server/db/models/user";

let dummyPasswordHash: Promise<string> | undefined;

async function compareWithDummyHash(password: string): Promise<void> {
  dummyPasswordHash ??= bcrypt.hash(randomBytes(32).toString("hex"), 12);
  await bcrypt.compare(password, await dummyPasswordHash);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-nelemane.session-token"
          : "nelemane.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const ip = getRequestIp(request.headers);
        const rateKey = createLoginRateKey(email, ip);

        if (!(await consumeRateLimit(rateKey))) {
          return null;
        }

        await connectToDatabase();
        const user = await UserModel.findOne({ email, status: "ACTIVE" })
          .select("+passwordHash")
          .exec();
        const passwordMatches = user
          ? await verifyPassword(password, user.passwordHash)
          : (await compareWithDummyHash(password), false);

        if (!user || !passwordMatches) {
          if (user) {
            await writeAuditLog({
              actorId: user._id,
              entity: "User",
              entityId: user._id,
              action: "auth.login.failure",
              meta: { result: "failure" },
              ip,
            });
          }

          return null;
        }

        await clearRateLimit(rateKey);
        user.lastLoginAt = new Date();
        await user.save();
        await writeAuditLog({
          actorId: user._id,
          entity: "User",
          entityId: user._id,
          action: "auth.login.success",
          meta: { result: "success", role: user.role },
          ip,
        });

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          pgId: user.pgId?.toString() ?? null,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.pgId = user.pgId;
        token.mustChangePassword = user.mustChangePassword;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role =
          token.role === "SUPER_ADMIN" ||
          token.role === "PG_OWNER" ||
          token.role === "TENANT"
            ? token.role
            : "TENANT";
        session.user.pgId =
          typeof token.pgId === "string" ? token.pgId : null;
        session.user.mustChangePassword =
          typeof token.mustChangePassword === "boolean"
            ? token.mustChangePassword
            : true;
      }

      return session;
    },
  },
});
