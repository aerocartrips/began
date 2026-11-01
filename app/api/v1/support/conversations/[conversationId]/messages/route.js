import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { assertRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { SUPPORT_RATE_LIMITS } from "@/lib/constants/support";
import { listCustomerMessages, sendCustomerMessage } from "@/lib/services/support-chat.service";

export const GET = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { conversationId } = await context.params;
  const { searchParams } = new URL(request.url);
  const result = await listCustomerMessages(user, conversationId, searchParams);
  return successResponse(result.items, "Messages fetched.", {
    hasMore: result.hasMore,
    conversation: result.conversation,
  });
});

export const POST = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { conversationId } = await context.params;
  const rateKey = `support:message:${user._id}`;
  await assertRateLimit(rateKey, SUPPORT_RATE_LIMITS.sendMessage, "You are sending messages too quickly. Please wait a moment.");

  const payload = await parseJsonBody(request, 24 * 1024);
  const result = await sendCustomerMessage(user, conversationId, payload);
  if (result.created) await recordRateLimitHit(rateKey, SUPPORT_RATE_LIMITS.sendMessage);

  return successResponse(
    result.message,
    result.created ? "Message sent." : "Message already received.",
    { conversation: result.conversation },
    result.created ? 201 : 200,
  );
});
