import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectToDatabase: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

vi.mock("@/server/db/connection", () => ({
  connectToDatabase: mocks.connectToDatabase,
}));

vi.mock("@/server/db/models/login-rate-limit", () => ({
  LoginRateLimitModel: { findOneAndUpdate: mocks.findOneAndUpdate },
}));

import { recordRateLimitHit } from "@/server/auth/login-rate-limit";

describe("login rate-limit pipeline updates", () => {
  beforeEach(() => {
    mocks.connectToDatabase.mockReset().mockResolvedValue(undefined);
    mocks.findOneAndUpdate.mockReset();
  });

  it("opts into update pipelines when creating or updating the rate limit", async () => {
    const lean = vi.fn().mockResolvedValue({ count: 1 });
    mocks.findOneAndUpdate.mockReturnValue({ lean });

    await expect(recordRateLimitHit("login-key", new Date("2026-10-18T00:00:00Z"))).resolves.toBe(1);

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { key: "login-key" },
      expect.any(Array),
      { upsert: true, returnDocument: "after", updatePipeline: true },
    );
  });

  it("keeps the pipeline option on the duplicate-key retry", async () => {
    const duplicateKeyError = Object.assign(new Error("duplicate key"), { code: 11000 });
    mocks.findOneAndUpdate
      .mockReturnValueOnce({ lean: vi.fn().mockRejectedValue(duplicateKeyError) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ count: 2 }) });

    await expect(recordRateLimitHit("login-key", new Date("2026-10-18T00:00:00Z"))).resolves.toBe(2);

    expect(mocks.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { key: "login-key" },
      expect.any(Array),
      { returnDocument: "after", updatePipeline: true },
    );
  });
});
