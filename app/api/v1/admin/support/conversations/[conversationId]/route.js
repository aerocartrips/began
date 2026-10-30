import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { getSupportConversationDetail } from "@/lib/services/support-messages.service";

export const GET = withDatabase(async (_request, context) => {
  await requireCommerceAdmin();
  const { conversationId } = await context.params;
  const detail = await getSupportConversationDetail(conversationId);
  return successResponse(detail, "Conversation fetched.");
});
