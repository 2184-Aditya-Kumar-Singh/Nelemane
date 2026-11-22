import { z } from "zod";

import { escapeHtml } from "@/server/admin/serializers";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { getPublicAppUrl } from "@/lib/public-app-url";
import { connectToDatabase } from "@/server/db/connection";
import { PaymentModel } from "@/server/db/models/payment";
import { PgModel } from "@/server/db/models/pg";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { TenantModel } from "@/server/db/models/tenant";
import { sendEmailOnce, sendSmsOnce } from "@/server/notifications/send-once";
import { getIstDateParts } from "@/server/payments/dates";

const reminderSchema = z.object({ chargeId: z.string().regex(/^[a-f\d]{24}$/i).optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional() });

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const parsed = reminderSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Choose a valid rent charge" } }, { status: 400 });
    await connectToDatabase();
    const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name reminder").lean();
    if (!pg) return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    const filter = { pgId, ...(parsed.data.chargeId ? { _id: parsed.data.chargeId } : {}), ...(parsed.data.month ? { month: parsed.data.month } : {}) };
    const charges = await RentChargeModel.find({ ...filter, status: { $in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } }).sort({ windowEnd: 1 }).limit(1000).lean();
    const output: Array<{ chargeId: string; email: string; sms: string }> = [];
    const appUrl = getPublicAppUrl(process.env.APP_URL)?.origin ?? "http://localhost:3000";
    const today = getIstDateParts().key;
    for (const charge of charges) {
      const pending = await PaymentModel.exists({ chargeId: charge._id, status: "PENDING" });
      if (pending || charge.paidAmount >= charge.amount) continue;
      const tenant = await TenantModel.findOne({ _id: charge.tenantId, pgId, status: "ACTIVE" }).select("name email phone").lean();
      if (!tenant) continue;
      const due = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Math.max(0, charge.amount - charge.paidAmount) / 100);
      const overdue = today > getIstDateParts(charge.windowEnd).key;
      const message = overdue
        ? `Rent of ${due} for ${charge.month} at ${pg.name} is overdue. Please pay your outstanding balance and register your payment in Nelemane.`
        : `The rent window for ${charge.month} at ${pg.name} is open. Your outstanding balance is ${due}. Please pay and register your payment in Nelemane.`;
      const dedupeKey = `rent-reminder-${charge._id.toString()}-${today}`;
      const [email, sms] = await Promise.all([
        pg.reminder.enabled && pg.reminder.email ? sendEmailOnce({
          to: tenant.email, template: overdue ? "rent-overdue-reminder" : "rent-window-open",
          dedupeKey, subject: overdue ? `Rent overdue · ${pg.name}` : `Rent window open · ${pg.name}`,
          text: message, html: `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(appUrl)}/tenant/rent">Open your rent account</a></p>`,
        }) : Promise.resolve({ status: "SKIPPED" as const }),
        pg.reminder.enabled && pg.reminder.sms ? sendSmsOnce({
          to: tenant.phone, template: overdue ? "rent-overdue-reminder" : "rent-window-open", dedupeKey: `${dedupeKey}-sms`, text: message,
        }) : Promise.resolve({ status: "SKIPPED" as const }),
      ]);
      const now = new Date();
      await RentChargeModel.updateOne({ _id: charge._id, pgId }, { $set: { lastReminderAt: now, ...(overdue ? { lastOverdueReminderAt: now } : {}) }, $inc: { reminderCount: 1 } });
      output.push({ chargeId: charge._id.toString(), email: email.status, sms: sms.status });
    }
    return Response.json({ sent: output.length, results: output });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Rent reminders could not be sent" } }, { status: 500 });
  }
}
