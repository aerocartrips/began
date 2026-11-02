import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import NotificationCenter from "@/features/notifications/components/notification-center";

export const metadata = { title: "Notifications | Admin" };

export default async function AdminNotificationsPage() {
  await guardAdminPage(PERMISSIONS.DASHBOARD_VIEW);
  return (
    <>
      <AdminPageHeading
        eyebrow="Operations"
        title="Notifications"
        description="Orders, payment and refund issues, support activity, inventory and integration alerts."
      />
      <NotificationCenter scope="admin" />
    </>
  );
}
