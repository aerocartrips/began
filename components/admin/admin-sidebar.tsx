import Link from "next/link";
import { Activity, ExternalLink } from "lucide-react";
import AdminNavigation from "@/components/admin/admin-navigation";
import { getCurrentTenant } from "@/lib/tenant/current";

export default async function AdminSidebar() {
  const tenant = await getCurrentTenant();
  return (
    <aside className="admin-sidebar">
      <Link className="admin-wordmark" href="/admin">
        <span className="admin-mark"><Activity size={17} aria-hidden="true" /></span>
        <span>{tenant.name.toUpperCase()} <small>ADMIN</small></span>
      </Link>
      <AdminNavigation />
      <Link className="admin-store-link" href="/">
        <ExternalLink size={14} aria-hidden="true" />
        View storefront
      </Link>
    </aside>
  );
}
