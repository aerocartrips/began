import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getSupportConversationDetail, updateSupportConversation } from "@/lib/services/support-messages.service";

export const GET = withDatabase(async (_request, context) => {
  await requireAdminAccess();
  const { conversationId } = await context.params;
  const detail = await getSupportConversationDetail(conversationId);
  return successResponse(detail, "Conversation fetched.");
});

export const PATCH = withDatabase(async (request, context) => {
  const access = await requireAdminAccess();
  const { conversationId } = await context.params;
  const payload = await parseJsonBody(request, 8 * 1024);
  const conversation = await updateSupportConversation(conversationId, access.user, payload);
  return successResponse(conversation, "Conversation updated.");
});
