import Link from "next/link";
import {
  Activity,
  CreditCard,
  LayoutDashboard,
  Mail,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  Star,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Returns", href: "/admin/returns", icon: RefreshCw },
  { label: "Messages", href: "/admin/messages", icon: Mail },
  { label: "Jobs", href: "/admin/jobs", icon: Truck },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Store settings", href: "/admin/settings", icon: Settings },
];

export default function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <Link className="admin-wordmark" href="/admin">
        <span className="admin-mark"><Activity size={17} aria-hidden="true" /></span>
        <span>NEOVASTRA <small>CONTROL ROOM</small></span>
      </Link>
      <nav className="admin-navigation" aria-label="Admin navigation">
        {navigation.map(({ label, href, icon: Icon }) => (
          <Link href={href} key={href}>
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <Link className="admin-store-link" href="/">View storefront</Link>
    </aside>
  );
}