import Link from "next/link";
import { logoutAdmin } from "@/lib/admin/actions";

type AdminHeaderProps = {
  email: string;
};

export default function AdminHeader({ email }: AdminHeaderProps) {
  return (
    <header className="admin-header">
      <details className="admin-mobile-navigation">
        <summary>Menu</summary>
        <nav aria-label="Mobile admin navigation">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/reviews">Reviews</Link>
          <Link href="/admin/products">Products</Link>
          <Link href="/admin/payments">Payments</Link>
          <Link href="/admin/messages">Messages</Link>
          <Link href="/admin/customers">Customers</Link>
          <Link href="/admin/settings">Store settings</Link>
        </nav>
      </details>
      <div className="admin-header-spacer" />
      <span className="admin-account-email">{email}</span>
      <form action={logoutAdmin}>
        <button className="admin-logout-button" type="submit">Sign out</button>
      </form>
    </header>
  );
}