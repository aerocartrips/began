import { withApiHandler, errorResponse, successResponse } from "@/lib/utils/api-response";
import { connectDB } from "@/lib/db/connect";
import { assertWebhookSecret } from "@/lib/razorpay/config";
import { verifyWebhookSignature } from "@/lib/razorpay/signature";
import { acceptWebhookEvent } from "@/lib/services/payment-webhook.service";

export const POST = withApiHandler(async (request) => {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  verifyWebhookSignature(rawBody, signature, assertWebhookSecret());
  await connectDB();
  const result = await acceptWebhookEvent(rawBody, request.headers);
  return successResponse(result, "Webhook accepted.");
});
