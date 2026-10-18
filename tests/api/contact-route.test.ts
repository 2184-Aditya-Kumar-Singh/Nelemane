import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasSameOrigin: vi.fn(),
  createRateLimitKey: vi.fn(),
  getRequestIp: vi.fn(),
  consumeRateLimit: vi.fn(),
  sendEmailOnce: vi.fn(),
  getEnv: vi.fn(),
}));

vi.mock("@/server/auth/request-origin", () => ({ hasSameOrigin: mocks.hasSameOrigin }));
vi.mock("@/server/auth/login-rate-limit", () => ({
  createRateLimitKey: mocks.createRateLimitKey,
  getRequestIp: mocks.getRequestIp,
  consumeRateLimit: mocks.consumeRateLimit,
}));
vi.mock("@/server/notifications/send-once", () => ({ sendEmailOnce: mocks.sendEmailOnce }));
vi.mock("@/lib/env", () => ({ getEnv: mocks.getEnv }));

import { POST } from "@/app/api/contact/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
}

const validMessage = {
  name: "<script>alert(1)</script>",
  email: "VISITOR@EXAMPLE.COM",
  topic: "SUPPORT",
  message: "<img src=x> Please help with my account.",
};

describe("public contact API", () => {
  beforeEach(() => {
    mocks.hasSameOrigin.mockReturnValue(true);
    mocks.createRateLimitKey.mockReturnValue("hashed-contact-key");
    mocks.getRequestIp.mockReturnValue("127.0.0.1");
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.sendEmailOnce.mockResolvedValue({ status: "SKIPPED" });
    mocks.getEnv.mockReturnValue({ ADMIN_EMAIL: "admin@example.com" });
  });

  it("rejects requests from a different origin before processing their body", async () => {
    mocks.hasSameOrigin.mockReturnValue(false);

    const response = await POST(makeRequest(validMessage));

    expect(response.status).toBe(403);
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    expect(mocks.sendEmailOnce).not.toHaveBeenCalled();
  });

  it("validates and safely emails a support message", async () => {
    const response = await POST(makeRequest(validMessage));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sent: true });
    expect(mocks.sendEmailOnce).toHaveBeenCalledOnce();
    const email = mocks.sendEmailOnce.mock.calls[0]?.[0] as { to: string; html: string };
    expect(email.to).toBe("admin@example.com");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;img src=x&gt;");
    expect(email.html).not.toContain("<script>");
  });

  it("returns a readable validation error for invalid messages", async () => {
    const response = await POST(makeRequest({ name: "", email: "nope", topic: "OTHER", message: "x" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { message: "Review your name, email and message" } });
    expect(mocks.sendEmailOnce).not.toHaveBeenCalled();
  });

  it("applies the public submission rate limit", async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);

    const response = await POST(makeRequest(validMessage));

    expect(response.status).toBe(429);
    expect(mocks.sendEmailOnce).not.toHaveBeenCalled();
  });
});
