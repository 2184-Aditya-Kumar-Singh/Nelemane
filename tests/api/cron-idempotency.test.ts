import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  connectToDatabase: vi.fn(),
  pgFind: vi.fn(),
  ensureRentChargesForMonth: vi.fn(),
  rentChargeFind: vi.fn(),
  rentChargeUpdate: vi.fn(),
  paymentExists: vi.fn(),
  tenantFindOne: vi.fn(),
  sendEmailOnce: vi.fn(),
  sendSmsOnce: vi.fn(),
  charge: null as { _id: unknown; pgId: unknown; tenantId: unknown; amount: number; paidAmount: number; windowStart: Date; windowEnd: Date; status: string; lastOverdueReminderAt?: Date; lastReminderAt?: Date; reminderCount?: number; month: string } | null,
}));

vi.mock("@/lib/env", () => ({ getEnv: mocks.getEnv }));
vi.mock("@/server/db/connection", () => ({ connectToDatabase: mocks.connectToDatabase }));
vi.mock("@/server/db/models/pg", () => ({ PgModel: { find: mocks.pgFind } }));
vi.mock("@/server/db/models/rent-charge", () => ({ RentChargeModel: { find: mocks.rentChargeFind, updateOne: mocks.rentChargeUpdate } }));
vi.mock("@/server/db/models/payment", () => ({ PaymentModel: { exists: mocks.paymentExists } }));
vi.mock("@/server/db/models/tenant", () => ({ TenantModel: { findOne: mocks.tenantFindOne } }));
vi.mock("@/server/notifications/send-once", () => ({ sendEmailOnce: mocks.sendEmailOnce, sendSmsOnce: mocks.sendSmsOnce }));
vi.mock("@/server/payments/charges", () => ({ ensureRentChargesForMonth: mocks.ensureRentChargesForMonth }));

import { Types } from "mongoose";
import { GET } from "@/app/api/cron/rent/route";

describe("daily rent cron API", () => {
  beforeEach(() => {
    const pgId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    const today = new Date();
    const yesterday = new Date(today.getTime() - 2 * 86_400_000);
    mocks.charge = {
      _id: new Types.ObjectId(), pgId, tenantId, amount: 80_000, paidAmount: 0,
      windowStart: yesterday, windowEnd: yesterday, status: "OVERDUE", reminderCount: 0, month: "2026-10",
    };
    mocks.getEnv.mockReturnValue({ CRON_SECRET: "unit-test-only", APP_URL: "http://localhost" });
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.pgFind.mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([{
      _id: pgId, name: "Demo PG", rentWindow: { startDay: 1, endDay: 5 },
      reminder: { enabled: true, email: true, sms: false, everyNDays: 2 },
    }]) });
    mocks.ensureRentChargesForMonth.mockResolvedValue(0);
    mocks.rentChargeFind.mockReturnValue({ sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([mocks.charge]) });
    mocks.rentChargeUpdate.mockImplementation(async (_filter: unknown, update: { $set?: Record<string, unknown>; $inc?: Record<string, number> }) => {
      Object.assign(mocks.charge!, update.$set);
      if (update.$inc?.reminderCount) mocks.charge!.reminderCount = (mocks.charge!.reminderCount ?? 0) + update.$inc.reminderCount;
      return { modifiedCount: 1 };
    });
    mocks.paymentExists.mockResolvedValue(null);
    mocks.tenantFindOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ name: "Demo Tenant", email: "tenant@example.invalid", phone: "9876501301" }),
    });
    mocks.sendEmailOnce.mockResolvedValue({ status: "SENT" });
    mocks.sendSmsOnce.mockResolvedValue({ status: "SKIPPED" });
  });

  it("sends an overdue reminder once for the same tenant and day", async () => {
    const makeRequest = () => new Request("http://localhost/api/cron/rent", { headers: { authorization: "Bearer unit-test-only" } });

    const first = await GET(makeRequest());
    const second = await GET(makeRequest());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await first.json()).notifications).toBe(1);
    expect((await second.json()).notifications).toBe(0);
    expect(mocks.sendEmailOnce).toHaveBeenCalledOnce();
  });
});
