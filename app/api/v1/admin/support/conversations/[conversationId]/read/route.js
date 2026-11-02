import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { markAdminConversationRead } from "@/lib/services/support-messages.service";

export const POST = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.SUPPORT_MANAGE);
  const { conversationId } = await context.params;
  const result = await markAdminConversationRead(conversationId);
  return successResponse(result, "Conversation marked as read.");
});
