import { HOME_SECTION_TYPES as T } from "@/lib/constants/homepage";

/**
 * @typedef {import("@/features/homepage/types").HomeSection} HomeSection
 */

const base = { enabled: true, description: "", limit: 10, viewAllHref: "", showOnMobile: true, showOnDesktop: true };

/**
 * The layout every store starts with, built to show the whole catalogue in a
 * few scrolls: shortcuts first, then personal picks, an overview of every
 * category, one tabbed row instead of three stacked ones, quick filters, and
 * finally the endless feed.
 * @returns {HomeSection[]}
 */
export function defaultHomeSections() {
  return [
    { ...base, key: "category-nav", type: T.CATEGORY_NAV, title: "" },
    { ...base, key: "hero", type: T.HERO, title: "" },
    { ...base, key: "trust", type: T.TRUST, title: "", items: [] },
    { ...base, key: "for-you", type: T.FOR_YOU, title: "Picked for you" },
    { ...base, key: "catalogue", type: T.CATALOGUE, title: "Explore the collection", viewAllHref: "/categories" },
    { ...base, key: "product-tabs", type: T.PRODUCT_TABS, title: "Shop the edit", tabs: ["bestsellers", "new", "trending"] },
    { ...base, key: "quick-picks", type: T.QUICK_PICKS, title: "Find your saree faster" },
    { ...base, key: "recently-viewed", type: T.RECENTLY_VIEWED, title: "Recently viewed" },
    { ...base, key: "reviews", type: T.REVIEWS, title: "What our buyers say", limit: 6 },
    { ...base, key: "cta", type: T.CTA, title: "", description: "" },
    { ...base, key: "guides", type: T.GUIDES, title: "Buying guides", limit: 4, viewAllHref: "/guides" },
    { ...base, key: "newsletter", type: T.NEWSLETTER, title: "New arrivals in your inbox", description: "Be first to see new weaves, restocks and offers." },
    { ...base, key: "feed", type: T.FEED, title: "All sarees", description: "", viewAllHref: "/products?sort=popular" },
  ];
}

/**
 * Trust strip used until the admin writes their own. Only claims the platform
 * itself backs: tiered pricing, quotes, GST invoices, tracked shipping, returns.
 * @param {"wholesale" | "retail"} salesMode
 */
export function defaultTrustItems(salesMode) {
  return salesMode === "wholesale"
    ? [
        { icon: "boxes", title: "Quantity pricing", text: "Per-piece prices drop as your order grows." },
        { icon: "file", title: "Custom quotes", text: "Request pricing for large or custom orders." },
        { icon: "badge", title: "GST invoices", text: "Tax invoices with your GSTIN on every order." },
        { icon: "truck", title: "Pan-India dispatch", text: "Tracked shipping on every consignment." },
      ]
    : [
        { icon: "badge", title: "Authentic weaves", text: "Every saree is checked before it ships." },
        { icon: "truck", title: "Tracked delivery", text: "Follow your order from dispatch to doorstep." },
        { icon: "refresh", title: "Easy returns", text: "Simple returns within the return window." },
      ];
}

/**
 * Call-to-action copy used until the admin writes their own. Quotes exist for
 * wholesale stores only (/request-quote), so retail stores point to contact.
 * @param {"wholesale" | "retail"} salesMode
 */
export function defaultCta(salesMode) {
  return salesMode === "wholesale"
    ? {
        title: "Buying in bulk?",
        description: "Get quantity pricing, GST invoices and a custom quote for large or repeat orders.",
        primaryCta: { label: "Request a quote", href: "/request-quote" },
        secondaryCta: { label: "Contact us", href: "/contact" },
      }
    : {
        title: "Need help choosing?",
        description: "Ask us about fabrics, weaves, occasions or an order. We're happy to help.",
        primaryCta: { label: "Contact us", href: "/contact" },
        secondaryCta: { label: "Browse the catalogue", href: "/products" },
      };
}

/**
 * The feed loads products endlessly, so anything placed after it could never
 * be reached: it always renders last.
 * @param {HomeSection[]} sections
 */
export function normalizeHomeSections(sections) {
  // Section types added after a store saved its layout appear too (admins can hide them, not delete them).
  const present = new Set(sections.map((section) => section.type));
  const keys = new Set(sections.map((section) => section.key));
  const added = defaultHomeSections().filter(
    (section) => section.type !== T.COLLECTION && !present.has(section.type) && !keys.has(section.key),
  );
  const all = [...sections, ...added];
  return [...all.filter((section) => section.type !== T.FEED), ...all.filter((section) => section.type === T.FEED)];
}
