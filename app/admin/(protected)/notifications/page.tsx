import AdminPageHeading from "@/components/admin/admin-page-heading";
import NotificationCenter from "@/features/notifications/components/notification-center";

export const metadata = { title: "Notifications | Norosilk Admin" };

export default function AdminNotificationsPage() {
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
