import { loadEnvConfig } from "@next/env";

import { APP_NAME } from "@/config/app";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/server/auth/password";
import { connectToDatabase } from "@/server/db/connection";
import { UserModel } from "@/server/db/models/user";

loadEnvConfig(process.cwd());

async function seedSuperAdmin(): Promise<void> {
  const env = getEnv();
  await connectToDatabase();

  const existingUser = await UserModel.findOne({ email: env.ADMIN_EMAIL })
    .select("role")
    .lean();

  if (existingUser) {
    if (existingUser.role !== "SUPER_ADMIN") {
      throw new Error("The configured administrator email belongs to another role");
    }

    console.info(`${APP_NAME} Super Admin account is already present.`);
    return;
  }

  await UserModel.create({
    role: "SUPER_ADMIN",
    name: "Super Admin",
    email: env.ADMIN_EMAIL,
    passwordHash: await hashPassword(env.ADMIN_INITIAL_PASSWORD),
    mustChangePassword: true,
    status: "ACTIVE",
  });

  console.info(`${APP_NAME} Super Admin account created; password change is required at first sign-in.`);
}

try {
  await seedSuperAdmin();
  process.exitCode = 0;
} catch {
  console.error("Super Admin seed failed. Check the environment and MongoDB connectivity.");
  process.exitCode = 1;
}
