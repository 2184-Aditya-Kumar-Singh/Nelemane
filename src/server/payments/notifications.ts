import "server-only";

import { escapeHtml } from "@/server/admin/serializers";
import { getEnv } from "@/lib/env";
import { sendEmailOnce } from "@/server/notifications/send-once";

export async function emailPaymentReceipt(input: {
  tenantName: string;
  tenantEmail: string;
  pgName: string;
  paymentId: string;
  month: string;
  amountPaise: number;
  transactionId?: string;
}) {
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(input.amountPaise / 100);
  const receiptUrl = `${getEnv().APP_URL}/tenant/receipts/${input.paymentId}`;
  const details = [
    `Hello ${input.tenantName},`,
    `Your ${amount} rent payment for ${input.month} at ${input.pgName} has been approved.`,
    input.transactionId ? `Transaction ID: ${input.transactionId}` : "",
    `Receipt: ${receiptUrl}`,
  ].filter(Boolean).join("\n\n");
  return sendEmailOnce({
    to: input.tenantEmail, template: "payment-approved-receipt", dedupeKey: `payment-receipt-${input.paymentId}`,
    subject: `Payment approved · ${input.month} · ${input.pgName}`,
    text: details,
    html: `<p>Hello ${escapeHtml(input.tenantName)},</p><p>Your ${escapeHtml(amount)} rent payment for ${escapeHtml(input.month)} at <strong>${escapeHtml(input.pgName)}</strong> has been approved.</p>${input.transactionId ? `<p>Transaction ID: ${escapeHtml(input.transactionId)}</p>` : ""}<p><a href="${escapeHtml(receiptUrl)}">View and print your receipt</a></p>`,
  });
}

export async function emailPaymentRejection(input: {
  tenantName: string;
  tenantEmail: string;
  pgName: string;
  paymentId: string;
  month: string;
  reason: string;
}) {
  const message = `Hello ${input.tenantName}, your payment submission for ${input.month} at ${input.pgName} was rejected. Reason: ${input.reason}. You can review the reason and submit corrected payment details from your Rent page.`;
  return sendEmailOnce({
    to: input.tenantEmail, template: "payment-rejected", dedupeKey: `payment-rejected-${input.paymentId}`,
    subject: `Payment needs correction · ${input.month} · ${input.pgName}`,
    text: message, html: `<p>${escapeHtml(message)}</p>`,
  });
}
