import { randomUUID } from "node:crypto";

import { contactSchema } from "@/lib/contact-schema";
import { escapeHtml } from "@/server/admin/serializers";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { consumeRateLimit, createRateLimitKey, getRequestIp } from "@/server/auth/login-rate-limit";
import { getEnv } from "@/lib/env";
import { sendEmailOnce } from "@/server/notifications/send-once";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const parsed = contactSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Review your name, email and message" } }, { status: 400 });
    const key = createRateLimitKey("public-contact", parsed.data.email, getRequestIp(request.headers));
    if (!await consumeRateLimit(key, 3)) return Response.json({ error: { message: "Please wait before sending another message" } }, { status: 429 });
    const topicLabel = { LIST_PG: "List a PG", GENERAL: "General question", SUPPORT: "Account support" }[parsed.data.topic];
    const text = `From: ${parsed.data.name} <${parsed.data.email}>\nTopic: ${topicLabel}\n\n${parsed.data.message}`;
    const result = await sendEmailOnce({
      to: getEnv().ADMIN_EMAIL, template: "public-contact", dedupeKey: `public-contact-${randomUUID()}`,
      subject: `${topicLabel} · Nelemane website`, text,
      html: `<p><strong>From:</strong> ${escapeHtml(parsed.data.name)} &lt;${escapeHtml(parsed.data.email)}&gt;</p><p><strong>Topic:</strong> ${escapeHtml(topicLabel)}</p><p>${escapeHtml(parsed.data.message).replace(/\n/g, "<br>")}</p>`,
    });
    if (result.status === "FAILED") return Response.json({ error: { message: "Your message could not be delivered right now" } }, { status: 503 });
    return Response.json({ sent: true }, { status: 201 });
  } catch {
    return Response.json({ error: { message: "Your message could not be delivered right now" } }, { status: 503 });
  }
}
