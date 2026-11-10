import type { SalesMode } from "@/lib/tenant/types";

export type NavigationItem = {
  label: string;
  href: string;
};

/**
 * Desktop header links. Wholesale stores also get the "Request a quote" button
 * beside them (components/layout/site-header.tsx), so it is not repeated here:
 * the duplicate pushed the header wider than 1440px screens.
 */
export function getSiteNavigation(): readonly NavigationItem[] {
  return [
    { label: "Catalogue", href: "/products" },
    { label: "Categories", href: "/categories" },
    { label: "Track order", href: "/track-order" },
    { label: "Contact", href: "/contact" },
  ];
}

export function getFooterColumns(salesMode: SalesMode) {
  return {
    shop: [
      { label: "All products", href: "/products" },
      { label: "Categories", href: "/categories" },
      { label: "Wishlist", href: "/wishlist" },
      ...(salesMode === "wholesale" ? [{ label: "Request a quote", href: "/request-quote" }] : []),
    ],
    account: [
      { label: "My account", href: "/account" },
      { label: "My orders", href: "/account/orders" },
      ...(salesMode === "wholesale" ? [{ label: "My quotes", href: "/account/quotes" }] : []),
      { label: "Support messages", href: "/account/support" },
    ],
    help: [
      { label: "Contact us", href: "/contact" },
      { label: "FAQ", href: "/faq" },
      { label: "Track an order", href: "/track-order" },
      { label: "Shipping", href: "/shipping" },
      { label: "Returns & refunds", href: "/returns" },
      { label: "Saree care guide", href: "/care-guide" },
      { label: "Buying guides", href: "/guides" },
    ],
    legal: [
      { label: "About us", href: "/about" },
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms & conditions", href: "/terms-and-conditions" },
      { label: "Cancellation & refund policy", href: "/returns" },
    ],
  } as const satisfies Record<string, readonly NavigationItem[]>;
}
