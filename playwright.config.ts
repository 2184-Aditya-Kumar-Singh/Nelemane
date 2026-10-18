import { defineConfig, devices } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";

const baseURL = "http://127.0.0.1:3110";
const testSecret = randomBytes(32).toString("base64url");
const cronSecret = randomBytes(32).toString("base64url");
const testEmail = `e2e-${randomUUID()}@example.invalid`;
const testPassword = randomBytes(24).toString("base64url");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1 --port 3110",
    url: `${baseURL}/login`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: "development",
      APP_URL: baseURL,
      AUTH_SECRET: testSecret,
      NEXTAUTH_URL: baseURL,
      NEXTAUTH_SECRET: testSecret,
      MONGODB_URI: "mongodb://127.0.0.1:27017/nelemane_e2e",
      CRON_SECRET: cronSecret,
      DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      ADMIN_EMAIL: testEmail,
      ADMIN_INITIAL_PASSWORD: testPassword,
    },
  },
});
