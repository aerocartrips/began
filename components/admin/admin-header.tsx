import { LogOut } from "lucide-react";
import AdminMobileNav from "@/components/admin/admin-mobile-nav";
import NotificationBell from "@/features/notifications/components/notification-bell";
import { logoutAdmin } from "@/lib/admin/actions";
import { getCurrentTenant } from "@/lib/tenant/current";

type AdminHeaderProps = {
  email: string;
};

export default async function AdminHeader({ email }: AdminHeaderProps) {
  const tenant = await getCurrentTenant();
  return (
    <header className="admin-header">
      <AdminMobileNav storeName={tenant.name} />
      <span className="admin-header-title">{tenant.name}</span>
      <div className="admin-header-spacer" />
      <NotificationBell scope="admin" />
      <span className="admin-account-avatar" aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
      <span className="admin-account-email">{email}</span>
      <form action={logoutAdmin}>
        <button className="admin-logout-button" type="submit" aria-label="Sign out">
          <LogOut size={13} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </form>
    </header>
  );
}
