/**
 * Transactional email delivery (Resend HTTP API).
 * Messages are optional; callers must persist data before notifying.
 */

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
    html: `<p>A new order <strong>${orderNumber}</strong> was placed by <strong>${customer}</strong>.</p><p>Total amount: <strong>${total}</strong></p>`,
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
    html: `<p><strong>${message.name}</strong> (${message.email}) sent a contact message.</p><p><strong>Subject:</strong> ${message.subject}</p><p><strong>Message ID:</strong> ${message.messageId}</p>`,
  });
}
