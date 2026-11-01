import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireCustomerInbox } from "@/lib/notifications/inbox";
import { readAllNotifications } from "@/lib/services/notification.service";

export const PATCH = withDatabase(async () => {
  const { recipient, audiences } = await requireCustomerInbox();
  return successResponse(await readAllNotifications(recipient, audiences), "All notifications marked as read.");
});
