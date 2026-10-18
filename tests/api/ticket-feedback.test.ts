import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasSameOrigin: vi.fn(),
  requireActiveTenant: vi.fn(),
  connectToDatabase: vi.fn(),
  ticketFindOne: vi.fn(),
  auditCreate: vi.fn(),
  pgFindOne: vi.fn(),
  emailTicketReopened: vi.fn(),
  closedTicket: null as { _id: unknown; status: string; title: string; timeline: unknown[]; save: ReturnType<typeof vi.fn> } | null,
  reopenedTicket: null as { _id: unknown; status: string; title: string; timeline: unknown[]; save: ReturnType<typeof vi.fn> } | null,
}));

vi.mock("@/server/auth/authorization", () => ({ authorizationErrorResponse: vi.fn(() => null) }));
vi.mock("@/server/auth/tenant-scope", () => ({ requireActiveTenant: mocks.requireActiveTenant }));
vi.mock("@/server/auth/request-origin", () => ({ hasSameOrigin: mocks.hasSameOrigin }));
vi.mock("@/server/db/connection", () => ({ connectToDatabase: mocks.connectToDatabase }));
vi.mock("@/server/db/models/ticket", () => ({ TicketModel: { findOne: mocks.ticketFindOne } }));
vi.mock("@/server/db/models/audit-log", () => ({ AuditLogModel: { create: mocks.auditCreate } }));
vi.mock("@/server/db/models/pg", () => ({ PgModel: { findOne: mocks.pgFindOne } }));
vi.mock("@/server/tickets/notifications", () => ({ emailTicketReopened: mocks.emailTicketReopened }));

import mongoose, { Types } from "mongoose";
import { PATCH } from "@/app/api/tenant/tickets/[ticketId]/route";

describe("tenant ticket feedback API", () => {
  beforeEach(() => {
    const tenantId = new Types.ObjectId();
    const makeTicket = (title: string) => ({
      _id: new Types.ObjectId(),
      status: "RESOLVED_AWAITING_APPROVAL",
      title,
      timeline: [],
      save: vi.fn().mockResolvedValue(undefined),
    });
    mocks.closedTicket = makeTicket("Fixed bathroom tap");
    mocks.reopenedTicket = makeTicket("WiFi is still down");
    mocks.hasSameOrigin.mockReturnValue(true);
    mocks.requireActiveTenant.mockResolvedValue({
      user: { id: new Types.ObjectId().toString() },
      tenant: { _id: tenantId, name: "Demo Tenant", roomId: new Types.ObjectId() },
      pgId: new Types.ObjectId().toString(),
    });
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.ticketFindOne.mockImplementation((query: { _id: string }) => ({
      select: vi.fn().mockReturnThis(),
      session: vi.fn().mockResolvedValue(query._id === (mocks.closedTicket!._id as Types.ObjectId).toString() ? mocks.closedTicket : mocks.reopenedTicket),
    }));
    mocks.auditCreate.mockResolvedValue([]);
    mocks.pgFindOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ name: "Demo PG", owner: { name: "Demo Owner", email: "owner@example.invalid" } }),
    });
    mocks.emailTicketReopened.mockResolvedValue({ status: "SKIPPED" });
    vi.spyOn(mongoose, "startSession").mockResolvedValue({
      withTransaction: async <T>(callback: () => Promise<T>) => callback(),
      endSession: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("closes an approved repair and reopens a failed repair with an owner notice", async () => {
    const cases = [
      { ticket: mocks.closedTicket!, body: { approved: true }, expected: "CLOSED" },
      { ticket: mocks.reopenedTicket!, body: { approved: false, comment: "The issue is still present." }, expected: "REOPENED" },
    ];

    for (const entry of cases) {
      const ticketId = (entry.ticket._id as Types.ObjectId).toString();
      const response = await PATCH(new Request(`http://localhost/api/tenant/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify(entry.body),
      }), { params: Promise.resolve({ ticketId }) });

      expect(response.status).toBe(200);
      expect((await response.json()).status).toBe(entry.expected);
      expect(entry.ticket.status).toBe(entry.expected);
      expect(entry.ticket.save).toHaveBeenCalledOnce();
    }

    expect(mocks.auditCreate).toHaveBeenCalledTimes(2);
    expect(mocks.emailTicketReopened).toHaveBeenCalledOnce();
  });
});
