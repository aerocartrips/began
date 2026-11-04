import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getClientIp } from "@/lib/security/client-ip";
import { isAutomatedRequest } from "@/lib/security/bot-detection";
import { activityClientKey, recordProductActivity } from "@/lib/services/product-activity.service";

/**
 * Records a product view, wishlist add or add-to-cart for popularity.
 * Always answers 202 so callers cannot probe what was counted.
 */
export const POST = withDatabase(async (request) => {
  const payload = await parseJsonBody(request, 1024);
  if (isAutomatedRequest(request.headers)) return successResponse({ counted: false }, "Ignored.", undefined, 202);
  const clientKey = activityClientKey(getClientIp(request), request.headers.get("user-agent") ?? "");
  return successResponse(await recordProductActivity(payload, clientKey), "Recorded.", undefined, 202);
});
