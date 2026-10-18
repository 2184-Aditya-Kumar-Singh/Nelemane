import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasSameOrigin: vi.fn(),
  requireRoles: vi.fn(),
  requirePgScope: vi.fn(),
  connectToDatabase: vi.fn(),
  paymentFindOne: vi.fn(),
  paymentExists: vi.fn(),
  chargeFindOne: vi.fn(),
  tenantFindOne: vi.fn(),
  pgFindOne: vi.fn(),
  auditCreate: vi.fn(),
  emailPaymentReceipt: vi.fn(),
  revalidatePaymentViews: vi.fn(),
  payment: null as { _id: unknown; chargeId: unknown; tenantId: unknown; month: string; transactionId: string; status: string; amountSubmitted: number; save: ReturnType<typeof vi.fn> } | null,
  charge: null as { _id: unknown; amount: number; paidAmount: number; windowEnd: Date; status: string; save: ReturnType<typeof vi.fn> } | null,
}));

vi.mock("@/server/auth/authorization", () => ({
  authorizationErrorResponse: vi.fn(() => null),
  requireRoles: mocks.requireRoles,
  requirePgScope: mocks.requirePgScope,
}));
vi.mock("@/server/auth/request-origin", () => ({ hasSameOrigin: mocks.hasSameOrigin }));
vi.mock("@/server/db/connection", () => ({ connectToDatabase: mocks.connectToDatabase }));
vi.mock("@/server/db/models/payment", () => ({
  PaymentModel: { findOne: mocks.paymentFindOne, exists: mocks.paymentExists },
}));
vi.mock("@/server/db/models/rent-charge", () => ({ RentChargeModel: { findOne: mocks.chargeFindOne } }));
vi.mock("@/server/db/models/tenant", () => ({ TenantModel: { findOne: mocks.tenantFindOne } }));
vi.mock("@/server/db/models/pg", () => ({ PgModel: { findOne: mocks.pgFindOne } }));
vi.mock("@/server/db/models/audit-log", () => ({ AuditLogModel: { create: mocks.auditCreate } }));
vi.mock("@/server/payments/notifications", () => ({ emailPaymentReceipt: mocks.emailPaymentReceipt }));
vi.mock("@/server/payments/revalidate", () => ({ revalidatePaymentViews: mocks.revalidatePaymentViews }));

import mongoose, { Types } from "mongoose";
import { POST } from "@/app/api/owner/payments/[paymentId]/approve/route";

describe("owner payment approval API", () => {
  beforeEach(() => {
    const paymentId = new Types.ObjectId();
    const chargeId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    mocks.payment = {
      _id: paymentId,
      chargeId,
      tenantId,
      month: "2026-12",
      transactionId: "DEMO12345678",
      status: "PENDING",
      amountSubmitted: 1_000,
      save: vi.fn().mockResolvedValue(undefined),
    };
    mocks.charge = {
      _id: chargeId,
      amount: 5_000,
      paidAmount: 0,
      windowEnd: new Date("2026-12-04T18:30:00.000Z"),
      status: "PENDING_VERIFICATION",
      save: vi.fn().mockResolvedValue(undefined),
    };

    mocks.hasSameOrigin.mockReturnValue(true);
    mocks.requireRoles.mockResolvedValue({ id: new Types.ObjectId().toString(), role: "PG_OWNER", pgId: "507f1f77bcf86cd799439011", mustChangePassword: false, email: "owner@example.invalid", name: "Demo Owner" });
    mocks.requirePgScope.mockReturnValue("507f1f77bcf86cd799439011");
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.paymentFindOne.mockImplementation(() => ({ session: vi.fn().mockResolvedValue(mocks.payment) }));
    mocks.paymentExists.mockReturnValue({ session: vi.fn().mockResolvedValue(null) });
    mocks.chargeFindOne.mockImplementation(() => ({ session: vi.fn().mockResolvedValue(mocks.charge) }));
    mocks.tenantFindOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ name: "Demo Tenant", email: "tenant@example.invalid" }),
    });
    mocks.pgFindOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ name: "Demo PG" }),
    });
    mocks.auditCreate.mockResolvedValue([]);
    mocks.emailPaymentReceipt.mockResolvedValue({ status: "SKIPPED" });
    mocks.revalidatePaymentViews.mockReturnValue(undefined);
    vi.spyOn(mongoose, "startSession").mockResolvedValue({
      withTransaction: async <T>(callback: () => Promise<T>) => callback(),
      endSession: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("adds an approved partial amount once and rejects a second approval", async () => {
    const paymentId = (mocks.payment!._id as Types.ObjectId).toString();
    const makeRequest = () => new Request(`http://localhost/api/owner/payments/${paymentId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ approvedAmountPaise: 1_000 }),
    });
    const context = { params: Promise.resolve({ paymentId }) };

    const first = await POST(makeRequest(), context);
    expect(first.status).toBe(200);
    expect(mocks.payment?.status).toBe("APPROVED");
    expect(mocks.charge?.paidAmount).toBe(1_000);
    expect(mocks.charge?.status).toBe("PARTIALLY_PAID");

    const second = await POST(makeRequest(), context);
    expect(second.status).toBe(409);
    expect(mocks.payment?.save).toHaveBeenCalledOnce();
    expect(mocks.charge?.save).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
    expect(mocks.emailPaymentReceipt).toHaveBeenCalledOnce();
    expect(mocks.revalidatePaymentViews).toHaveBeenCalledOnce();
  });
});
