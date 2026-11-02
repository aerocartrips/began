import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { trackOrderForGuest } from "@/lib/services/order-tracking.service";

const TRACK_RATE_LIMIT = { limit: 15, windowMs: 15 * 60 * 1000 };

/** Guest order tracking (order number + email or phone). */
export const POST = withDatabase(async (request, { tenant }) => {
  await consumeRateLimit(`order-track:${tenant.id}:${getClientIp(request)}`, TRACK_RATE_LIMIT);
  const result = await trackOrderForGuest(await parseJsonBody(request, 4 * 1024));
  return successResponse(result, "Order found.");
});
