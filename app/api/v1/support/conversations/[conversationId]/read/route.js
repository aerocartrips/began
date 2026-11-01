import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { markCustomerConversationRead } from "@/lib/services/support-chat.service";

export const POST = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  const { conversationId } = await context.params;
  const result = await markCustomerConversationRead(user, conversationId);
  return successResponse(result, "Conversation marked as read.");
});
