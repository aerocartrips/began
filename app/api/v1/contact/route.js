import { after } from "next/server";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { ApiError } from "@/lib/utils/api-error";
import { logger } from "@/lib/utils/logger";
import { getClientIp } from "@/lib/security/client-ip";
import { getAuthUser } from "@/lib/auth/session";
import { ROLES } from "@/lib/constants/roles";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { notifyContactMessage } from "@/lib/services/email.service";
import { submitContactMessage } from "@/lib/services/support-messages.service";

const CONTACT_RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };

export const POST = withDatabase(async (request) => {
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`contact:${ip}`, CONTACT_RATE_LIMIT);
  if (!limit.allowed) {
    throw new ApiError(429, "Too many messages were sent. Please wait before trying again.");
  }

  const payload = await parseJsonBody(request, 16 * 1024);
  const authUser = await getAuthUser();
  const customer = authUser?.role === ROLES.CUSTOMER ? authUser : null;
  const { input, messageId } = await submitContactMessage(payload, { customer });
  await recordRateLimitHit(`contact:${ip}`, CONTACT_RATE_LIMIT);

  after(() =>
    notifyContactMessage({
      name: input.name,
      email: input.email,
      subject: input.subject,
      messageId,
    }).catch((error) => logger.warn("Contact notification email failed", { error, messageId })),
  );

  return successResponse({ messageId }, "Message received.", undefined, 201);
});
