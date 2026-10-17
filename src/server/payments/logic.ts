import "server-only";

import type { RentChargeRecord, RentChargeStatus } from "@/server/db/models/rent-charge";
import { getIstDateParts } from "@/server/payments/dates";

type ChargeWithWindow = Pick<RentChargeRecord, "amount" | "paidAmount" | "windowEnd">;

export function deriveChargeStatus(charge: ChargeWithWindow, hasPendingPayment: boolean, now = new Date()): RentChargeStatus {
  if (charge.paidAmount >= charge.amount) return "PAID";
  if (hasPendingPayment) return "PENDING_VERIFICATION";
  const today = getIstDateParts(now).key;
  const endDay = getIstDateParts(charge.windowEnd).key;
  if (today > endDay) return "OVERDUE";
  return charge.paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID";
}
