import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getClientIp } from "@/lib/security/client-ip";
import { isAutomatedRequest } from "@/lib/security/bot-detection";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { activityClientKey } from "@/lib/services/product-activity.service";
import { recordAnalyticsEvents } from "@/lib/services/analytics.service";

const HOUR_MS = 60 * 60 * 1000;
/** Batches per client per hour (each holds at most 25 events). */
const BATCHES_PER_HOUR = 120;

/**
 * Storefront analytics beacon. Bots and over-limit clients are ignored (not
 * rejected), so a misbehaving client learns nothing; always answers 202.
 */
export const POST = withDatabase(async (request) => {
  const payload = await parseJsonBody(request, 8 * 1024);
  if (isAutomatedRequest(request.headers)) return successResponse({ recorded: 0 }, "Ignored.", undefined, 202);
  const key = `analytics:${activityClientKey(getClientIp(request), request.headers.get("user-agent") ?? "")}`;
  if (!(await checkRateLimit(key, { limit: BATCHES_PER_HOUR })).allowed) return successResponse({ recorded: 0 }, "Ignored.", undefined, 202);
  await recordRateLimitHit(key, { windowMs: HOUR_MS });
  return successResponse(await recordAnalyticsEvents(payload), "Recorded.", undefined, 202);
});
