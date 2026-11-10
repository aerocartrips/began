"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, LayoutGrid, ShoppingCart, UserRound, type LucideIcon } from "lucide-react";
import VisibleStyle from "@/components/ui/visible-style";
import { useCartCount } from "@/features/cart/cart-store";
import { useHydrated } from "@/lib/client/persistent-store";
import { PHONE_QUERY } from "@/lib/constants/breakpoints";
import CountBadge, { badgeCount } from "@/components/ui/count-badge";

/** Read by --bottom-ui in app/mobile.css: content and toasts stay clear of the bar. */
const RESERVE_BOTTOM_EDGE = ":root { --tabbar-space: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px)); }";

type Tab = { href: string; label: string; icon: LucideIcon; section: (pathname: string) => boolean };

const TABS: Tab[] = [
  { href: "/", label: "Home", icon: Home, section: (path) => path === "/" },
  { href: "/categories", label: "Shop", icon: LayoutGrid, section: (path) => path.startsWith("/categories") || path.startsWith("/products") },
  { href: "/wishlist", label: "Wishlist", icon: Heart, section: (path) => path.startsWith("/wishlist") },
  { href: "/cart", label: "Cart", icon: ShoppingCart, section: (path) => path.startsWith("/cart") || path.startsWith("/checkout") },
  { href: "/account", label: "Account", icon: UserRound, section: (path) => path.startsWith("/account") },
];

/** `pathname` is null while the URL is not known yet (no tab highlighted). */
function TabBar({ pathname }: { pathname: string | null }) {
  const hydrated = useHydrated();
  const cartCount = useCartCount();
  const cartItems = hydrated ? cartCount : 0;

  return (
    <>
      <VisibleStyle css={RESERVE_BOTTOM_EDGE} media={PHONE_QUERY} />
      <nav className="mobile-tabbar" aria-label="Quick navigation">
        {TABS.map(({ href, label, icon: Icon, section }) => {
          const inSection = pathname !== null && section(pathname);
          const count = href === "/cart" ? cartItems : 0;
          const badge = badgeCount(count);
          return (
            <Link
              key={href}
              href={href}
              className="mobile-tabbar__item"
              aria-current={inSection ? (pathname === href ? "page" : "true") : undefined}
              aria-label={badge ? `${label}, ${badge} in cart` : undefined}
            >
              <span className="mobile-tabbar__icon">
                <Icon size={22} strokeWidth={inSection ? 2.2 : 1.7} aria-hidden="true" />
                <CountBadge count={count} corner />
              </span>
              <span className="mobile-tabbar__label">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/**
 * App-style bottom navigation for phones. Hidden by CSS on wider screens and
 * while a page's own action bar is on screen (components/layout/mobile-action-bar.tsx).
 * Reading the URL can suspend (Cache Components), so SiteShell wraps this in
 * <Suspense> with <MobileTabBarFallback />.
 */
export default function MobileTabBar() {
  return <TabBar pathname={usePathname()} />;
}

/** The same bar without a highlighted tab, while the URL is only known at request time. */
export function MobileTabBarFallback() {
  return <TabBar pathname={null} />;
}
