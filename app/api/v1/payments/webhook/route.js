import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { assertWebhookSecret } from "@/lib/razorpay/config";
import { verifyWebhookSignature } from "@/lib/razorpay/signature";
import { acceptWebhookEvent } from "@/lib/services/payment-webhook.service";

/**
 * Configure each store's Razorpay webhook as https://<store domain>/api/v1/payments/webhook;
 * the Host header selects the store whose webhook secret verifies the signature.
 */
export const POST = withDatabase(async (request) => {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  verifyWebhookSignature(rawBody, signature, await assertWebhookSecret());
  const result = await acceptWebhookEvent(rawBody, request.headers);
  return successResponse(result, "Webhook accepted.");
});
