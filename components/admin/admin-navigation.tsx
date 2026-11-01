"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  Mail,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  Star,
  Timer,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = { label: string; href: string; icon: LucideIcon };

const navigationGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Commerce",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard },
      { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
      { label: "Payments", href: "/admin/payments", icon: CreditCard },
      { label: "Customers", href: "/admin/customers", icon: Users },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Reviews", href: "/admin/reviews", icon: Star },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Returns", href: "/admin/returns", icon: RefreshCw },
      { label: "Messages", href: "/admin/messages", icon: Mail },
      { label: "Jobs", href: "/admin/jobs", icon: Timer },
      { label: "Store settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNavigation({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className={variant === "sidebar" ? "admin-navigation" : "admin-mobile-navigation__panel"}
      aria-label={variant === "sidebar" ? "Admin navigation" : "Mobile admin navigation"}
    >
      {navigationGroups.map((group) => (
        <div className="admin-navigation__group" key={group.label}>
          <p className="admin-navigation__label">{group.label}</p>
          {group.items.map(({ label, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                href={href}
                key={href}
                className={active ? "is-active" : undefined}
                aria-current={active ? "page" : undefined}
                onClick={variant === "mobile" ? (event) => event.currentTarget.closest("details")?.removeAttribute("open") : undefined}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
