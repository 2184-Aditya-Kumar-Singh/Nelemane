import { timingSafeEqual } from "node:crypto";

import { escapeHtml } from "@/server/admin/serializers";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel } from "@/server/db/models/pg";
import { PaymentModel } from "@/server/db/models/payment";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { TenantModel } from "@/server/db/models/tenant";
import { getEnv } from "@/lib/env";
import { sendEmailOnce, sendSmsOnce } from "@/server/notifications/send-once";
import { ensureRentChargesForMonth } from "@/server/payments/charges";
import { daysBetweenDateKeys, getIstDateParts, getIstMonthKey } from "@/server/payments/dates";
import { deriveChargeStatus } from "@/server/payments/logic";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request, secret: string): boolean {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(token);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

function dateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function GET(request: Request) {
  const env = getEnv();
  if (!authorized(request, env.CRON_SECRET)) return Response.json({ error: { message: "Unauthorized" } }, { status: 401 });
  try {
    await connectToDatabase();
    const today = getIstDateParts().key;
    const month = getIstMonthKey();
    const pgs = await PgModel.find({ status: "ACTIVE", "subscription.status": "ACTIVE" }).select("name rentWindow reminder owner").lean();
    let generatedCharges = 0;
    let notifications = 0;
    for (const pg of pgs) {
      generatedCharges += await ensureRentChargesForMonth({ pgId: pg._id.toString(), month, window: pg.rentWindow });
      const charges = await RentChargeModel.find({ pgId: pg._id, $expr: { $lt: ["$paidAmount", "$amount"] } }).sort({ month: 1, windowEnd: 1 }).lean();
      for (const charge of charges) {
        const pending = await PaymentModel.exists({ chargeId: charge._id, status: "PENDING" });
        const status = deriveChargeStatus(charge, Boolean(pending));
        if (status !== charge.status) await RentChargeModel.updateOne({ _id: charge._id, pgId: pg._id }, { $set: { status } });
        if (pending || status === "PAID" || today < dateKey(charge.windowStart)) continue;
        const isOverdue = today > dateKey(charge.windowEnd);
        if (isOverdue) {
          const lastKey = charge.lastOverdueReminderAt ? dateKey(charge.lastOverdueReminderAt) : "";
          if (lastKey && daysBetweenDateKeys(lastKey, today) < pg.reminder.everyNDays) continue;
        } else if (charge.lastReminderAt) {
          continue;
        }
        const tenant = await TenantModel.findOne({ _id: charge.tenantId, pgId: pg._id, status: "ACTIVE" }).select("name email phone").lean();
        if (!tenant) continue;
        const due = Math.max(0, charge.amount - charge.paidAmount);
        const dueText = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(due / 100);
        const message = isOverdue
          ? `Rent of ${dueText} for ${charge.month} at ${pg.name} is overdue. Please pay and register your payment in Nelemane.`
          : `The rent window for ${charge.month} at ${pg.name} is open. Your outstanding balance is ${dueText}. Please pay and register your payment in Nelemane.`;
        const dayDedupe = `rent-reminder-${charge._id.toString()}-${today}`;
        const [email, sms] = await Promise.all([
          pg.reminder.enabled && pg.reminder.email ? sendEmailOnce({
            to: tenant.email, template: isOverdue ? "rent-overdue-reminder" : "rent-window-open", dedupeKey: dayDedupe,
            subject: isOverdue ? `Rent overdue · ${pg.name}` : `Rent window open · ${pg.name}`,
            text: message, html: `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(env.APP_URL)}/tenant/rent">Open your rent account</a></p>`,
          }) : Promise.resolve({ status: "SKIPPED" as const }),
          pg.reminder.enabled && pg.reminder.sms ? sendSmsOnce({
            to: tenant.phone, template: isOverdue ? "rent-overdue-reminder" : "rent-window-open", dedupeKey: `${dayDedupe}-sms`, text: message,
          }) : Promise.resolve({ status: "SKIPPED" as const }),
        ]);
        const now = new Date();
        await RentChargeModel.updateOne({ _id: charge._id, pgId: pg._id }, {
          $set: { lastReminderAt: now, ...(isOverdue ? { lastOverdueReminderAt: now } : {}) },
          $inc: { reminderCount: 1 },
        });
        if (email.status === "SENT" || sms.status === "SENT") notifications += 1;
      }
    }
    return Response.json({ ok: true, date: today, month, pgs: pgs.length, generatedCharges, notifications });
  } catch {
    return Response.json({ error: { message: "Rent reminder job failed" } }, { status: 500 });
  }
}
