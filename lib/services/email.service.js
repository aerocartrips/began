/**
 * Transactional email delivery (Resend HTTP API).
 * Messages are optional; callers must persist data before notifying.
 */

import { logger } from "@/lib/utils/logger";

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * @param {unknown} value
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.NOTIFY_EMAIL_TO?.trim());
}

/**
 * @param {{ subject: string, text: string, html?: string, replyTo?: string }} payload
 */
export async function sendTransactionalEmail(payload) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.NOTIFY_EMAIL_FROM || "Norosilk <onboarding@resend.dev>",
      to: [process.env.NOTIFY_EMAIL_TO],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      reply_to: payload.replyTo,
    }),
  });

  if (!response.ok) {
    logger.warn("Transactional email rejected by provider", {
      status: response.status,
      subject: payload.subject,
    });
    return { sent: false, reason: "provider_error" };
  }

  return { sent: true };
}

/**
 * @param {Record<string, unknown>} order
 */
export async function notifyNewOrder(order) {
  const orderNumber = order.orderNumber || "Unknown";
  const total = order.totalAmount ?? 0;
  const customer =
    typeof order.customer === "object" && order.customer?.email
      ? order.customer.email
      : "customer";

  return sendTransactionalEmail({
    subject: `New wholesale order ${orderNumber}`,
    text: `A new order (${orderNumber}) was placed by ${customer}. Total amount: ${total}. Review it in the admin dashboard.`,
    html: `<p>A new order <strong>${escapeHtml(orderNumber)}</strong> was placed by <strong>${escapeHtml(customer)}</strong>.</p><p>Total amount: <strong>${escapeHtml(total)}</strong></p>`,
  });
}

/**
 * @param {{ name: string, email: string, subject: string, messageId: string }} message
 */
export async function notifyContactMessage(message) {
  return sendTransactionalEmail({
    subject: `New contact message: ${message.subject}`,
    replyTo: message.email,
    text: `${message.name} (${message.email}) sent a contact message.\nSubject: ${message.subject}\nMessage ID: ${message.messageId}`,
    html: `<p><strong>${escapeHtml(message.name)}</strong> (${escapeHtml(message.email)}) sent a contact message.</p><p><strong>Subject:</strong> ${escapeHtml(message.subject)}</p><p><strong>Message ID:</strong> ${escapeHtml(message.messageId)}</p>`,
  });
}
