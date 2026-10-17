import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel } from "@/server/db/models/pg";
import { PaymentModel } from "@/server/db/models/payment";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { RoomModel } from "@/server/db/models/room";
import { RoomTypeModel } from "@/server/db/models/room-type";
import { TenantModel } from "@/server/db/models/tenant";
import { ensureRentChargesForMonth } from "@/server/payments/charges";
import { getIstMonthKey } from "@/server/payments/dates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    await connectToDatabase();
    const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("rentWindow").lean();
    if (!pg) return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    const requestedMonth = new URL(request.url).searchParams.get("month") ?? getIstMonthKey();
    if (!/^\d{4}-\d{2}$/.test(requestedMonth)) return Response.json({ error: { message: "Choose a valid rent month" } }, { status: 400 });
    if (requestedMonth === getIstMonthKey()) await ensureRentChargesForMonth({ pgId, month: requestedMonth, window: pg.rentWindow });
    const charges = await RentChargeModel.find({ pgId, month: requestedMonth }).sort({ status: 1, windowEnd: 1 }).limit(3000).lean();
    const tenantIds = charges.map((charge) => charge.tenantId);
    const tenants = await TenantModel.find({ _id: { $in: tenantIds }, pgId }).select("name email phone status monthlyRent roomId").lean();
    const tenantMap = new Map(tenants.map((tenant) => [tenant._id.toString(), tenant]));
    const roomIds = tenants.map((tenant) => tenant.roomId);
    const rooms = await RoomModel.find({ _id: { $in: roomIds }, pgId }).select("roomNumber floor block roomTypeId").lean();
    const roomMap = new Map(rooms.map((room) => [room._id.toString(), room]));
    const typeIds = rooms.map((room) => room.roomTypeId);
    const types = await RoomTypeModel.find({ _id: { $in: typeIds }, pgId }).select("name").lean();
    const typeMap = new Map(types.map((type) => [type._id.toString(), type.name]));
    const payments = await PaymentModel.find({ pgId, month: requestedMonth }).select("tenantId chargeId status amountSubmitted approvedAmount mode transactionId createdAt").sort({ createdAt: -1 }).lean();
    const paymentMap = new Map<string, typeof payments>();
    for (const payment of payments) {
      const key = payment.chargeId.toString();
      paymentMap.set(key, [...(paymentMap.get(key) ?? []), payment]);
    }
    const rows = charges.map((charge) => {
      const tenant = tenantMap.get(charge.tenantId.toString());
      const room = tenant ? roomMap.get(tenant.roomId.toString()) : null;
      const roomType = room ? typeMap.get(room.roomTypeId.toString()) ?? "" : "";
      const relatedPayments = paymentMap.get(charge._id.toString()) ?? [];
      const pending = relatedPayments.filter((payment) => payment.status === "PENDING");
      return {
        id: charge._id.toString(), tenantId: charge.tenantId.toString(), tenantName: tenant?.name ?? "Former tenant",
        email: tenant?.email ?? "", phone: tenant?.phone ?? "", tenantStatus: tenant?.status ?? "VACATED",
        roomNumber: room?.roomNumber ?? "—", floor: room?.floor ?? "", block: room?.block ?? "", roomType,
        month: charge.month, amountPaise: charge.amount, paidAmountPaise: charge.paidAmount,
        dueAmountPaise: Math.max(0, charge.amount - charge.paidAmount), status: charge.status,
        windowStart: charge.windowStart.toISOString(), windowEnd: charge.windowEnd.toISOString(),
        pendingPaymentPaise: pending.reduce((sum, payment) => sum + payment.amountSubmitted, 0),
        paymentHistory: relatedPayments.slice(0, 8).map((payment) => ({ id: payment._id.toString(), status: payment.status, submittedPaise: payment.amountSubmitted, approvedPaise: payment.approvedAmount ?? null, mode: payment.mode, transactionId: payment.transactionId ?? "", createdAt: payment.createdAt.toISOString() })),
      };
    });
    const roomSummaryMap = new Map<string, { label: string; residents: number; duePaise: number; overduePaise: number; pendingPaise: number }>();
    for (const row of rows) {
      const key = (row.block || "") + "|" + row.roomNumber;
      const current = roomSummaryMap.get(key) ?? { label: (row.block ? row.block + " · " : "") + row.roomNumber, residents: 0, duePaise: 0, overduePaise: 0, pendingPaise: 0 };
      current.residents += 1;
      current.duePaise += row.dueAmountPaise;
      current.pendingPaise += row.pendingPaymentPaise;
      if (row.status === "OVERDUE") current.overduePaise += row.dueAmountPaise;
      roomSummaryMap.set(key, current);
    }
    return Response.json({ month: requestedMonth, rows, totals: {
      collectedPaise: charges.reduce((sum, charge) => sum + charge.paidAmount, 0),
      outstandingPaise: charges.reduce((sum, charge) => sum + Math.max(0, charge.amount - charge.paidAmount), 0),
      pendingVerificationPaise: rows.reduce((sum, row) => sum + row.pendingPaymentPaise, 0),
      overduePaise: charges.reduce((sum, charge) => sum + (charge.status === "OVERDUE" ? Math.max(0, charge.amount - charge.paidAmount) : 0), 0),
      tenantCount: charges.length,
    }, roomSummaries: [...roomSummaryMap.values()].sort((a, b) => a.label.localeCompare(b.label)) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Rent ledger could not be loaded" } }, { status: 500 });
  }
}
