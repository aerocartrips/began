import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { unsubscribeNewsletter } from "@/lib/services/newsletter.service";

export const POST = withDatabase(async (request) => {
  await consumeRateLimit(`newsletter:token:${getClientIp(request)}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  return successResponse(await unsubscribeNewsletter(await parseJsonBody(request, 1024)), "You have been unsubscribed.");
});
