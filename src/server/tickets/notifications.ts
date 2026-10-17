import "server-only";

import { escapeHtml } from "@/server/admin/serializers";
import { getEnv } from "@/lib/env";
import { sendEmailOnce } from "@/server/notifications/send-once";

export async function emailTicketCreated(input: { to: string; ownerName: string; pgName: string; tenantName: string; ticketId: string; title: string }) {
  const url = `${getEnv().APP_URL}/owner/tickets/${input.ticketId}`;
  const text = `${input.tenantName} reported “${input.title}” at ${input.pgName}. Review the ticket in Nelemane.`;
  return sendEmailOnce({
    to: input.to, template: "ticket-created", dedupeKey: `ticket-created-${input.ticketId}`,
    subject: `New maintenance request · ${input.pgName}`,
    text: `${text}\n\n${url}`,
    html: `<p>Hello ${escapeHtml(input.ownerName)},</p><p>${escapeHtml(text)}</p><p><a href="${escapeHtml(url)}">Open ticket</a></p>`,
  });
}

export async function emailTicketResolved(input: { to: string; tenantName: string; pgName: string; ticketId: string; title: string; token: string }) {
  const url = new URL(`/ticket-approval/${input.ticketId}`, getEnv().APP_URL);
  url.searchParams.set("token", input.token);
  const text = `${input.title} was marked solved at ${input.pgName}. Review the proof and approve the fix or reopen the ticket. This link expires in 7 days.`;
  return sendEmailOnce({
    to: input.to, template: "ticket-awaiting-approval", dedupeKey: `ticket-approval-${input.ticketId}-${input.token.slice(0, 12)}`,
    subject: `Please review your repair · ${input.pgName}`,
    text: `Hello ${input.tenantName}, ${text}\n\n${url.toString()}`,
    html: `<p>Hello ${escapeHtml(input.tenantName)},</p><p>${escapeHtml(text)}</p><p><a href="${escapeHtml(url.toString())}">Review the repair</a></p>`,
  });
}

export async function emailTicketReopened(input: { to: string; ownerName: string; pgName: string; ticketId: string; title: string; comment: string }) {
  const url = `${getEnv().APP_URL}/owner/tickets/${input.ticketId}`;
  const text = `${input.title} was reopened by the tenant at ${input.pgName}. Their note: ${input.comment}`;
  return sendEmailOnce({
    to: input.to, template: "ticket-reopened", dedupeKey: `ticket-reopened-${input.ticketId}-${Date.now()}`,
    subject: `Ticket reopened · ${input.pgName}`,
    text: `${text}\n\n${url}`,
    html: `<p>Hello ${escapeHtml(input.ownerName)},</p><p>${escapeHtml(text)}</p><p><a href="${escapeHtml(url)}">Open ticket</a></p>`,
  });
}
