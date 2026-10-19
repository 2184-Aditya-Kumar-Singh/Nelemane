import { Types } from "mongoose";

import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { connectToDatabase } from "@/server/db/connection";
import { PaymentModel } from "@/server/db/models/payment";
import { PgModel } from "@/server/db/models/pg";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { decryptSensitiveValue } from "@/server/security/encryption";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ chargeId: string }> }) {
  try {
    const { tenant, pgId } = await requireActiveTenant();
    const { chargeId } = await context.params;
    if (!Types.ObjectId.isValid(chargeId)) return Response.json({ error: { message: "Rent charge was not found" } }, { status: 404 });
    await connectToDatabase();
    const [charge, pg] = await Promise.all([
      RentChargeModel.findOne({ _id: chargeId, pgId, tenantId: tenant._id }).lean(),
      PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name owner.phone paymentDetails").lean(),
    ]);
    if (!charge || !pg) return Response.json({ error: { message: "Rent charge was not found" } }, { status: 404 });
    const pending = await PaymentModel.findOne({ chargeId: charge._id, pgId, tenantId: tenant._id, status: "PENDING" }).select("_id amountSubmitted createdAt").lean();
    const details = pg.paymentDetails;
    const storedQrAccounts = details.qrAccounts?.length
      ? details.qrAccounts
      : details.qrImage
        ? [{ accountHolderName: pg.owner.name, upiId: details.upiId ?? "", qrImage: details.qrImage }]
        : [];
    const qrAccounts = storedQrAccounts.map((account, index) => ({
      accountHolderName: account.accountHolderName,
      upiId: account.upiId,
      qrImageUrl: `/api/tenant/rent/${charge._id.toString()}/qr/${index}`,
    }));
    return Response.json({
      charge: { id: charge._id.toString(), month: charge.month, amountPaise: charge.amount, paidAmountPaise: charge.paidAmount, dueAmountPaise: Math.max(0, charge.amount - charge.paidAmount), status: charge.status, windowStart: charge.windowStart.toISOString(), windowEnd: charge.windowEnd.toISOString() },
      pg: { name: pg.name, ownerPhone: pg.owner.phone },
      paymentDetails: {
        qrAccounts,
        bank: details.bank ? { accountHolderName: details.bank.accountHolderName, bankName: details.bank.bankName, accountNumber: decryptSensitiveValue(details.bank.accountNumber), ifsc: details.bank.ifsc, branch: details.bank.branch ?? "" } : null,
        instructions: details.instructions ?? "",
      },
      pendingPayment: pending ? { id: pending._id.toString(), amountPaise: pending.amountSubmitted, createdAt: pending.createdAt.toISOString() } : null,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Rent payment details could not be loaded" } }, { status: 500 });
  }
}
