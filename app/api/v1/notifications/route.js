import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireCustomerInbox } from "@/lib/notifications/inbox";
import { listNotifications } from "@/lib/services/notification.service";

export const GET = withDatabase(async (request) => {
  const { recipient, audiences } = await requireCustomerInbox();
  const { items, meta } = await listNotifications(recipient, new URL(request.url).searchParams, audiences);
  return successResponse(items, "Notifications fetched.", meta);
});
