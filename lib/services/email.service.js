/**
 * Transactional email delivery (Resend HTTP API).
 * Messages are optional; callers must persist data before notifying.
 */

import { logger } from "@/lib/utils/logger";
import { getActiveTenant } from "@/lib/tenant/active";

const EMAIL_TIMEOUT_MS = 10_000;

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * @param {unknown} value
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

/** Whether email can be delivered at all (platform Resend account + sender). */
export function isCustomerEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.NOTIFY_EMAIL_FROM?.trim());
}

/** Sender address from NOTIFY_EMAIL_FROM, displayed with the current store's name. */
function senderFor(storeName) {
  const configured = process.env.NOTIFY_EMAIL_FROM.trim();
  const address = /<([^>]+)>/.exec(configured)?.[1] ?? configured;
  return `${storeName.replace(/[<>"]/g, "")} <${address}>`;
}

/**
 * Sends to `to` when given (customer mail), otherwise to the current store's
 * notification inbox (Tenant.notifications.email, or its contact email).
 * @param {{ subject: string, text: string, html?: string, replyTo?: string, to?: string }} payload
 */
export async function sendTransactionalEmail(payload) {
  if (!isCustomerEmailConfigured()) return { sent: false, reason: "not_configured" };
  const tenant = await getActiveTenant();
  const to = payload.to ?? tenant.notificationEmail;
  if (!to) return { sent: false, reason: "no_store_inbox" };

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderFor(tenant.name),
        to: [to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        reply_to: payload.replyTo,
      }),
      // A slow provider must not hold up the request that sends the email.
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn("Transactional email could not reach the provider", { error, subject: payload.subject });
    return { sent: false, reason: "network_error" };
  }

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

/**
 * One-time code that confirms an email address. The code leads the subject so
 * it can be read (and autofilled on phones) straight from the notification.
 * @param {{ to: string, name: string, code: string, minutes: number, isChange: boolean }} message
 */
export async function sendEmailVerificationCode(message) {
  const { name: storeName } = await getActiveTenant();
  const intro = message.isChange
    ? `Enter this code to make ${message.to} the email address of your ${storeName} account:`
    : `Enter this code to confirm the email address of your ${storeName} account:`;
  const validity = `It expires in ${message.minutes} minutes and works once. Never share it: ${storeName} will never ask you for it.`;
  const ignore = "If you didn't request it, ignore this email; nothing changes on your account.";
  return sendTransactionalEmail({
    to: message.to,
    subject: `${message.code} is your ${storeName} verification code`,
    text: `Hello ${message.name},

${intro}

${message.code}

${validity}

${ignore}`,
    html: `<p>Hello ${escapeHtml(message.name)},</p><p>${escapeHtml(intro)}</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0">${escapeHtml(message.code)}</p><p>${escapeHtml(validity)}</p><p>${escapeHtml(ignore)}</p>`,
  });
}

/**
 * "Forgot password" link. Sent only to existing customer accounts; the request
 * page answers the same either way.
 * @param {{ to: string, name: string, resetUrl: string }} message
 */
export async function sendPasswordResetEmail(message) {
  const { name: storeName } = await getActiveTenant();
  return sendTransactionalEmail({
    to: message.to,
    subject: `Reset your ${storeName} password`,
    text: `Hello ${message.name},

Someone asked to reset the password of your ${storeName} account.
Choose a new password within 30 minutes: ${message.resetUrl}

If it wasn't you, ignore this email; your password stays the same.`,
    html: `<p>Hello ${escapeHtml(message.name)},</p><p>Someone asked to reset the password of your ${escapeHtml(storeName)} account.</p><p><a href="${escapeHtml(message.resetUrl)}">Choose a new password</a> (valid for 30 minutes)</p><p>If it wasn't you, ignore this email; your password stays the same.</p>`,
  });
}

/**
 * Security notice to the previous address after an email change.
 * @param {{ to: string, name: string, newEmail: string }} message
 */
export async function sendEmailChangedNotice(message) {
  const { name: storeName } = await getActiveTenant();
  return sendTransactionalEmail({
    to: message.to,
    subject: `Your ${storeName} account email was changed`,
    text: `Hello ${message.name},

The email on your ${storeName} account was changed to ${message.newEmail}. If you did not make this change, contact ${storeName} support immediately.`,
    html: `<p>Hello ${escapeHtml(message.name)},</p><p>The email on your ${escapeHtml(storeName)} account was changed to <strong>${escapeHtml(message.newEmail)}</strong>.</p><p>If you did not make this change, contact ${escapeHtml(storeName)} support immediately.</p>`,
  });
}
