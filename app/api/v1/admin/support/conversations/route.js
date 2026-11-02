import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import {
  addSupportAdminMessage,
  listSupportConversations,
  updateSupportConversation,
} from "@/lib/services/support-messages.service";

export const GET = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.SUPPORT_MANAGE);
  const searchParams = new URL(request.url).searchParams;
  const result = await listSupportConversations({
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    view: searchParams.get("view") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: Number(searchParams.get("page") ?? 1),
    limit: Number(searchParams.get("limit") ?? 50),
  });
  return successResponse(result.items, "Support conversations fetched.", { ...result.meta, counts: result.counts });
});

/** @deprecated Prefer PATCH /api/v1/admin/support/conversations/:conversationId */
export const PATCH = withDatabase(async (request) => {
  const access = await requireAdminAccess(PERMISSIONS.SUPPORT_MANAGE);
  const { conversationId, ...payload } = await parseJsonBody(request);
  const conversation = await updateSupportConversation(conversationId, access.user, payload);
  return successResponse(conversation, "Conversation updated.");
});

/** @deprecated Prefer POST /api/v1/admin/support/conversations/:conversationId/messages */
export const POST = withDatabase(async (request) => {
  const access = await requireAdminAccess(PERMISSIONS.SUPPORT_MANAGE);
  const payload = await parseJsonBody(request);
  const message = await addSupportAdminMessage(payload.conversationId, access.user, payload.body, payload.clientMessageId);
  return successResponse(message, "Reply sent.");
});
