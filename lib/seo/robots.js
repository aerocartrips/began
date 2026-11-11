import { storeOrigin } from "@/lib/seo/urls";

/**
 * Robots meta for pages that should rank: index them, and let Search and
 * Discover show large image previews and full-length snippets.
 * @type {import("next").Metadata["robots"]}
 */
export const ROBOTS_INDEX = { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 };

/** Useful to shoppers, not as a search result (filtered listings, cart, sign-in): links are still followed. */
export const ROBOTS_NOINDEX = { index: false, follow: true };

/** Behind a sign-in or a one-time link (account, admin, newsletter confirmations). */
export const ROBOTS_PRIVATE = { index: false, follow: false };

/**
 * Crawl rules for every store, following Google's guidance on faceted
 * navigation: shoppers' carts, accounts and the admin are never crawled, and
 * neither are filter, sort or search variations of a listing (they multiply
 * into endless URLs that rank for nothing). A listing's plain pages stay
 * crawlable, `?page=N` included, and so do products and their `?color=` URLs.
 * When rules overlap, the longest one wins, so `/products?page=2` is allowed
 * while `/products?fabric=silk` and `/products?page=2&sort=newest` are not.
 */
const DISALLOW = [
  "/admin",
  "/account",
  "/api/",
  "/cart",
  "/checkout",
  "/wishlist",
  "/newsletter/",
  "/search",
  "/request-quote?",
  "/products?",
  "/products?page=*&",
  "/categories/*?",
  "/categories/*?page=*&",
];
const ALLOW = ["/", "/products?page=", "/categories/*?page="];

/**
 * robots.txt for a store, or for a host that serves no store (nothing to crawl).
 * @param {{ primaryDomain: string } | null} tenant
 */
export function robotsTxt(tenant) {
  if (!tenant) return "User-agent: *\nDisallow: /\n";
  return [
    "User-agent: *",
    ...ALLOW.map((path) => `Allow: ${path}`),
    ...DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${storeOrigin(tenant)}/sitemap.xml`,
    "",
  ].join("\n");
}
