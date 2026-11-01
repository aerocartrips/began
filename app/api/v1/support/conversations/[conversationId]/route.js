import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getCustomerConversation, updateCustomerConversation } from "@/lib/services/support-chat.service";

export const GET = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  const { conversationId } = await context.params;
  const conversation = await getCustomerConversation(user, conversationId);
  return successResponse(conversation, "Conversation fetched.");
});

export const PATCH = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { conversationId } = await context.params;
  const payload = await parseJsonBody(request, 4 * 1024);
  const conversation = await updateCustomerConversation(user, conversationId, payload);
  return successResponse(conversation, "Conversation updated.");
});
