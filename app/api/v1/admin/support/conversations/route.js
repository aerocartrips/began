import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import {
  addSupportAdminMessage,
  getSupportConversationDetail,
  listSupportConversations,
  updateSupportConversation,
} from "@/lib/services/support-messages.service";

export const GET = withDatabase(async (request) => {
  await requireCommerceAdmin();
  const searchParams = new URL(request.url).searchParams;
  const items = await listSupportConversations({
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });
  return successResponse(items, "Support conversations fetched.");
});

export const PATCH = withDatabase(async (request) => {
  const admin = await requireCommerceAdmin();
  const payload = await parseJsonBody(request);
  const conversation = await updateSupportConversation(payload.conversationId, admin, payload);
  return successResponse(conversation, "Conversation updated.");
});

export const POST = withDatabase(async (request) => {
  const admin = await requireCommerceAdmin();
  const payload = await parseJsonBody(request);
  const message = await addSupportAdminMessage(payload.conversationId, admin, payload.body);
  return successResponse(message, "Reply sent.");
});
