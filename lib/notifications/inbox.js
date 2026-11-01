import { requireAuthUser } from "@/lib/auth/session";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { NOTIFICATION_RECIPIENT } from "@/lib/constants/notifications";
import { adminRecipientFromAccess } from "@/lib/notifications/admin-recipients";

/**
 * The signed-in customer's own inbox. The recipient always comes from the
 * session, never from the request, so one user can never read another's notifications.
 */
export async function requireCustomerInbox() {
  const user = await requireAuthUser();
  return {
    recipient: { recipientType: NOTIFICATION_RECIPIENT.CUSTOMER, recipientId: user._id },
    audiences: null,
  };
}

/** The signed-in admin's inbox, limited to the audiences their role may see. */
export async function requireAdminInbox() {
  return adminRecipientFromAccess(await requireAdminAccess());
}
