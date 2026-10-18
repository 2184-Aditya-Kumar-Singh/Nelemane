import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRoles: vi.fn(),
  requirePgScope: vi.fn(),
  connectToDatabase: vi.fn(),
  ticketFindOne: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  authorizationErrorResponse: vi.fn(() => null),
  requireRoles: mocks.requireRoles,
  requirePgScope: mocks.requirePgScope,
}));
vi.mock("@/server/db/connection", () => ({ connectToDatabase: mocks.connectToDatabase }));
vi.mock("@/server/db/models/ticket", () => ({ TicketModel: { findOne: mocks.ticketFindOne } }));

import { GET } from "@/app/api/owner/tickets/[ticketId]/route";

describe("owner ticket detail API scope", () => {
  beforeEach(() => {
    mocks.requireRoles.mockResolvedValue({ id: "507f1f77bcf86cd799439012", role: "PG_OWNER", pgId: "507f1f77bcf86cd799439013", mustChangePassword: false, email: "owner@example.com", name: "Demo Owner" });
    mocks.requirePgScope.mockReturnValue("507f1f77bcf86cd799439013");
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.ticketFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
  });

  it("queries only within the authenticated owner's PG and hides foreign tickets as not found", async () => {
    const ticketId = "507f1f77bcf86cd799439014";
    const response = await GET(new Request(`http://localhost/api/owner/tickets/${ticketId}`), {
      params: Promise.resolve({ ticketId }),
    });

    expect(response.status).toBe(404);
    expect(mocks.ticketFindOne).toHaveBeenCalledWith({ _id: ticketId, pgId: "507f1f77bcf86cd799439013" });
  });
});
