import { LogOut, Menu } from "lucide-react";
import AdminNavigation from "@/components/admin/admin-navigation";
import NotificationBell from "@/features/notifications/components/notification-bell";
import { logoutAdmin } from "@/lib/admin/actions";

type AdminHeaderProps = {
  email: string;
};

export default function AdminHeader({ email }: AdminHeaderProps) {
  return (
    <header className="admin-header">
      <details className="admin-mobile-navigation">
        <summary>
          <Menu size={15} aria-hidden="true" />
          Menu
        </summary>
        <AdminNavigation variant="mobile" />
      </details>
      <div className="admin-header-spacer" />
      <NotificationBell scope="admin" />
      <span className="admin-account-avatar" aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
      <span className="admin-account-email">{email}</span>
      <form action={logoutAdmin}>
        <button className="admin-logout-button" type="submit">
          <LogOut size={13} aria-hidden="true" />
          Sign out
        </button>
      </form>
    </header>
  );
}
