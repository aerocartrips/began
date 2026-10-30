import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/utils/api-error";

function safeCompare(expected, received) {
  if (typeof expected !== "string" || typeof received !== "string") return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyPaymentSignature({ orderId, paymentId, signature, secret }) {
  if (!orderId || !paymentId || !signature || !secret) {
    throw new ApiError(400, "Payment verification payload is incomplete.");
  }
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  if (!safeCompare(expected, String(signature))) {
    throw new ApiError(400, "Payment signature verification failed.");
  }
}

export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) {
    throw new ApiError(400, "Webhook signature verification failed.");
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!safeCompare(expected, String(signature))) {
    throw new ApiError(400, "Webhook signature verification failed.");
  }
}
