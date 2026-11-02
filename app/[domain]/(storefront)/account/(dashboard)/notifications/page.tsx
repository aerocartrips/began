import AccountHeading from "@/features/account/components/account-heading";
import NotificationCenter from "@/features/notifications/components/notification-center";

export const metadata = {
  title: "Notifications",
  description: "Order, payment, delivery and support updates for your account.",
};

export default function AccountNotificationsPage() {
  return (
    <>
      <AccountHeading title="Notifications" lead="Order, payment, delivery and support updates in one place." />
      <NotificationCenter scope="customer" />
    </>
  );
}
