import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { subscribeToNewsletter } from "@/lib/services/newsletter.service";

const HOUR_MS = 60 * 60 * 1000;

/** Newsletter sign-up (double opt-in when email is configured). */
export const POST = withDatabase(async (request) => {
  await consumeRateLimit(`newsletter:ip:${getClientIp(request)}`, { limit: 10, windowMs: HOUR_MS }, "Too many sign-up attempts. Please try again later.");
  const result = await subscribeToNewsletter(await parseJsonBody(request, 2048));
  const message = result.status === "pending" ? "Check your inbox to confirm your subscription." : "You're subscribed.";
  return successResponse(result, message, undefined, 202);
});
