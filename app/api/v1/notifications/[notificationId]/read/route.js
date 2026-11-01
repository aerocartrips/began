import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireCustomerInbox } from "@/lib/notifications/inbox";
import { readNotification } from "@/lib/services/notification.service";

export const PATCH = withDatabase(async (_request, context) => {
  const { recipient, audiences } = await requireCustomerInbox();
  const { notificationId } = await context.params;
  return successResponse(await readNotification(recipient, notificationId, audiences), "Notification marked as read.");
});
