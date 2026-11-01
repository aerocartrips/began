import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { createCheckoutPaymentOrder } from "@/lib/services/payment.service";
import { ApiError } from "@/lib/utils/api-error";

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`payment-create:${ip}:${user._id}`);
  if (!limit.allowed) {
    throw new ApiError(429, "Too many payment attempts. Please wait before trying again.");
  }

  const payload = await parseJsonBody(request, 64 * 1024);
  const checkout = await createCheckoutPaymentOrder(user, payload);
  await recordRateLimitHit(`payment-create:${ip}:${user._id}`);
  return successResponse(checkout, "Razorpay order created successfully.", undefined, 201);
});
