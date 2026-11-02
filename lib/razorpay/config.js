import { ApiError } from "@/lib/utils/api-error";
import { getCurrentIntegrations } from "@/lib/tenant/integrations";

/** Razorpay credentials of the current store (Tenant.integrations.razorpay). */
export async function assertRazorpayConfig() {
  const { razorpay } = await getCurrentIntegrations();
  if (!razorpay.keyId || !razorpay.keySecret) {
    throw new ApiError(503, "Online payments are not configured for this store.");
  }
  return { key_id: razorpay.keyId, key_secret: razorpay.keySecret };
}

export async function getPublicRazorpayKeyId() {
  return (await getCurrentIntegrations()).razorpay.keyId;
}

export async function isRazorpayConfigured() {
  const { razorpay } = await getCurrentIntegrations();
  return Boolean(razorpay.keyId && razorpay.keySecret);
}

export async function assertWebhookSecret() {
  const { razorpay } = await getCurrentIntegrations();
  if (!razorpay.webhookSecret) {
    throw new ApiError(503, "Razorpay webhook secret is not configured for this store.");
  }
  return razorpay.webhookSecret;
}
