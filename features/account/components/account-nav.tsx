"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_NAV_ITEMS } from "@/features/account/nav-items";
import { useSalesMode } from "@/features/tenant/tenant-provider";

function isActive(pathname: string, href: string) {
  return href === "/account" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AccountNav() {
  const pathname = usePathname();
  const salesMode = useSalesMode();
  const items = ACCOUNT_NAV_ITEMS.filter((item) => !("wholesaleOnly" in item) || salesMode === "wholesale");
  return (
    <nav className="account-nav" aria-label="Account">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined}>
          <Icon size={15} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
