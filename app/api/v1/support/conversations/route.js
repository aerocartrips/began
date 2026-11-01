import { after } from "next/server";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { ApiError } from "@/lib/utils/api-error";
import { SUPPORT_RATE_LIMITS } from "@/lib/constants/support";
import { logger } from "@/lib/utils/logger";
import { notifyContactMessage } from "@/lib/services/email.service";
import { createCustomerConversation, listCustomerConversations } from "@/lib/services/support-chat.service";

export const GET = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const { searchParams } = new URL(request.url);
  const result = await listCustomerConversations(user, searchParams);
  return successResponse(result.items, "Conversations fetched.", result.meta);
});

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const rateKey = `support:create:${user._id}`;
  const limit = await checkRateLimit(rateKey, SUPPORT_RATE_LIMITS.createConversation);
  if (!limit.allowed) {
    const error = new ApiError(429, "You have started several conversations recently. Please continue an existing one or try again later.");
    error.retryAfter = limit.retryAfter;
    throw error;
  }

  const payload = await parseJsonBody(request, 16 * 1024);
  const { conversation, created } = await createCustomerConversation(user, payload);

  if (created) {
    await recordRateLimitHit(rateKey, SUPPORT_RATE_LIMITS.createConversation);
    after(() =>
      notifyContactMessage({
        name: user.name,
        email: user.email,
        subject: conversation.subject,
        messageId: conversation.id,
      }).catch((error) => logger.warn("Support notification email failed", { error, conversationId: conversation.id })),
    );
  }

  return successResponse(conversation, created ? "Conversation started." : "Conversation already exists.", undefined, created ? 201 : 200);
});
