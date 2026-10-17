import "server-only";

import { TenantModel } from "@/server/db/models/tenant";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { dateKeyForMonthDay, getIstDateParts, istMidnightUtc } from "@/server/payments/dates";

export async function ensureRentChargesForMonth(input: {
  pgId: string;
  month: string;
  window: { startDay: number; endDay: number };
}): Promise<number> {
  const tenants = await TenantModel.find({ pgId: input.pgId, status: "ACTIVE" }).select("_id monthlyRent").lean();
  if (!tenants.length) return 0;
  const start = istMidnightUtc(dateKeyForMonthDay(input.month, input.window.startDay));
  const end = istMidnightUtc(dateKeyForMonthDay(input.month, input.window.endDay));
  const today = getIstDateParts().key;
  const defaultStatus = today > dateKeyForMonthDay(input.month, input.window.endDay) ? "OVERDUE" : "UNPAID";
  const results = await RentChargeModel.bulkWrite(tenants.map((tenant) => ({
    updateOne: {
      filter: { pgId: input.pgId, tenantId: tenant._id, month: input.month },
      update: { $setOnInsert: {
        pgId: tenant.pgId,
        tenantId: tenant._id,
        month: input.month,
        amount: tenant.monthlyRent,
        paidAmount: 0,
        windowStart: start,
        windowEnd: end,
        status: defaultStatus,
        reminderCount: 0,
      } },
      upsert: true,
    },
  })), { ordered: false });
  return results.upsertedCount;
}
