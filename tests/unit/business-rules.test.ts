import { describe, expect, it } from "vitest";

import { contactSchema } from "@/lib/contact-schema";
import { ticketFeedbackSchema, ticketResolutionSchema } from "@/lib/ticket-schemas";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { loginSchema, newPasswordSchema } from "@/server/auth/schemas";
import { getIstMenuDay } from "@/server/menus/dates";
import { getIstMonthKey, istMidnightUtc } from "@/server/payments/dates";
import { deriveChargeStatus } from "@/server/payments/logic";

describe("rent status rules", () => {
  const windowEnd = istMidnightUtc("2026-09-05");

  it("treats an approved full amount as paid even while another submission is pending", () => {
    expect(
      deriveChargeStatus(
        { amount: 12_500, paidAmount: 12_500, windowEnd },
        true,
        new Date("2026-09-06T03:00:00.000Z"),
      ),
    ).toBe("PAID");
  });

  it("keeps a pending verification ahead of overdue status", () => {
    expect(
      deriveChargeStatus(
        { amount: 12_500, paidAmount: 0, windowEnd },
        true,
        new Date("2026-09-06T03:00:00.000Z"),
      ),
    ).toBe("PENDING_VERIFICATION");
  });

  it("leaves a partial balance due before the end of the IST rent window", () => {
    expect(
      deriveChargeStatus(
        { amount: 12_500, paidAmount: 4_000, windowEnd },
        false,
        new Date("2026-09-04T19:00:00.000Z"),
      ),
    ).toBe("PARTIALLY_PAID");
  });

  it("marks an unpaid charge overdue after the end day in IST", () => {
    expect(
      deriveChargeStatus(
        { amount: 12_500, paidAmount: 0, windowEnd },
        false,
        new Date("2026-09-05T18:30:00.000Z"),
      ),
    ).toBe("OVERDUE");
  });
});

describe("India-local date and input rules", () => {
  it("assigns the month using the Asia/Kolkata calendar", () => {
    expect(getIstMonthKey(new Date("2026-01-31T19:00:00.000Z"))).toBe("2026-02");
  });

  it("uses the next calendar day when UTC is still on Sunday but IST has reached Monday", () => {
    expect(getIstMenuDay(new Date("2026-10-11T20:00:00.000Z"))).toBe("mon");
  });

  it("accepts only requests with an exact same-origin header", () => {
    expect(hasSameOrigin(new Request("https://nelemane.example/api", { headers: { origin: "https://nelemane.example" } }))).toBe(true);
    expect(hasSameOrigin(new Request("https://nelemane.example/api", { headers: { origin: "https://attacker.example" } }))).toBe(false);
    expect(hasSameOrigin(new Request("https://nelemane.example/api"))).toBe(false);
  });

  it("normalizes login and contact emails and rejects weak passwords", () => {
    expect(loginSchema.parse({ email: " OWNER@EXAMPLE.COM ", password: "welcome" }).email).toBe("owner@example.com");
    expect(contactSchema.parse({ name: "A Resident", email: " HELP@EXAMPLE.COM ", topic: "SUPPORT", message: "Please help with my account." }).email).toBe("help@example.com");
    expect(newPasswordSchema.safeParse("short").success).toBe(false);
    expect(newPasswordSchema.safeParse("long-enough-password").success).toBe(true);
  });

  it("requires proof photos to resolve a ticket and a comment to reopen it", () => {
    expect(ticketResolutionSchema.safeParse({ action: "RESOLVE", note: "Replaced the tap cartridge", imageAssetIds: [] }).success).toBe(false);
    expect(ticketResolutionSchema.safeParse({ action: "RESOLVE", note: "Replaced the tap cartridge", imageAssetIds: ["507f1f77bcf86cd799439011"] }).success).toBe(true);
    expect(ticketFeedbackSchema.safeParse({ approved: false }).success).toBe(false);
    expect(ticketFeedbackSchema.safeParse({ approved: false, comment: "The leak is still present." }).success).toBe(true);
  });
});
