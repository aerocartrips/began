import { ApiError } from "@/lib/utils/api-error";

export function assertRazorpayConfig() {
  const key_id = process.env.RAZORPAY_KEY_ID?.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!key_id || !key_secret) {
    throw new ApiError(503, "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  return { key_id, key_secret };
}

export function getPublicRazorpayKeyId() {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || process.env.RAZORPAY_KEY_ID?.trim() || "";
}

export function isRazorpayConfigured() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() &&
      process.env.RAZORPAY_KEY_SECRET?.trim() &&
      getPublicRazorpayKeyId(),
  );
}

export function assertWebhookSecret() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new ApiError(503, "Razorpay webhook secret is not configured.");
  }
  return secret;
}
