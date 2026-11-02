import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { addSupportAdminMessage, listAdminConversationMessages } from "@/lib/services/support-messages.service";

export const GET = withDatabase(async (request, context) => {
  await requireAdminAccess(PERMISSIONS.SUPPORT_MANAGE);
  const { conversationId } = await context.params;
  const { searchParams } = new URL(request.url);
  const result = await listAdminConversationMessages(conversationId, searchParams);
  return successResponse(result.items, "Messages fetched.", {
    hasMore: result.hasMore,
    conversation: result.conversation,
  });
});

export const POST = withDatabase(async (request, context) => {
  const access = await requireAdminAccess(PERMISSIONS.SUPPORT_MANAGE);
  const { conversationId } = await context.params;
  const payload = await parseJsonBody(request, 24 * 1024);
  const { created, ...message } = await addSupportAdminMessage(conversationId, access.user, payload.body, payload.clientMessageId);
  return successResponse(message, created ? "Reply sent." : "Reply already received.", undefined, created ? 201 : 200);
});
