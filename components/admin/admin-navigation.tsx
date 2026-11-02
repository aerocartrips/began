"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  FileText,
  FolderTree,
  Newspaper,
  Tags,
  UserCog,
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
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useAdminPermissions } from "@/components/admin/admin-session-provider";

type NavItem = { label: string; href: string; icon: LucideIcon; permission: string };

const navigationGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Commerce",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
      { label: "Orders", href: "/admin/orders", icon: ShoppingBag, permission: PERMISSIONS.ORDERS_MANAGE },
      { label: "Payments", href: "/admin/payments", icon: CreditCard, permission: PERMISSIONS.PAYMENTS_REFUND },
      { label: "Quotes", href: "/admin/quotes", icon: FileText, permission: PERMISSIONS.QUOTES_MANAGE },
      { label: "Customers", href: "/admin/customers", icon: Users, permission: PERMISSIONS.CUSTOMERS_MANAGE },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", icon: Package, permission: PERMISSIONS.CATALOG_MANAGE },
      { label: "Categories", href: "/admin/categories", icon: FolderTree, permission: PERMISSIONS.CATALOG_MANAGE },
      { label: "Attributes", href: "/admin/attributes", icon: Tags, permission: PERMISSIONS.CATALOG_MANAGE },
      { label: "Reviews", href: "/admin/reviews", icon: Star, permission: PERMISSIONS.REVIEWS_MODERATE },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Returns", href: "/admin/returns", icon: RefreshCw, permission: PERMISSIONS.RETURNS_MANAGE },
      { label: "Messages", href: "/admin/messages", icon: Mail, permission: PERMISSIONS.SUPPORT_MANAGE },
      { label: "Jobs", href: "/admin/jobs", icon: Timer, permission: PERMISSIONS.JOBS_RUN },
      { label: "Pages", href: "/admin/content", icon: Newspaper, permission: PERMISSIONS.SETTINGS_MANAGE },
      { label: "Staff & roles", href: "/admin/staff", icon: UserCog, permission: PERMISSIONS.STAFF_MANAGE },
      { label: "Store settings", href: "/admin/settings", icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNavigation({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const pathname = usePathname() ?? "";
  const permissions = useAdminPermissions();
  const groups = navigationGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => permissions.has(item.permission)) }))
    .filter((group) => group.items.length > 0);

  return (
    <nav
      className={variant === "sidebar" ? "admin-navigation" : "admin-mobile-navigation__panel"}
      aria-label={variant === "sidebar" ? "Admin navigation" : "Mobile admin navigation"}
    >
      {groups.map((group) => (
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
