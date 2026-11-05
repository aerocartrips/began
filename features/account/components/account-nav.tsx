"use client";

import { useEffect, useRef } from "react";
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
  const navRef = useRef<HTMLElement>(null);
  const items = ACCOUNT_NAV_ITEMS.filter((item) => !("wholesaleOnly" in item) || salesMode === "wholesale");

  // On phones the links are one swipeable row; bring the current section into view.
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2 });
  }, [pathname]);

  return (
    <nav ref={navRef} className="account-nav" aria-label="Account">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined}>
          <Icon size={15} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
