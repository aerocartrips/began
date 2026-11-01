import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminInbox } from "@/lib/notifications/inbox";
import { getUnreadCount } from "@/lib/services/notification.service";

export const GET = withDatabase(async () => {
  const { recipient, audiences } = await requireAdminInbox();
  return successResponse(await getUnreadCount(recipient, audiences), "Unread count fetched.");
});
