import { DEFAULT_SECTION_PRODUCTS, HOME_SECTION_TYPES as T } from "@/lib/constants/homepage";
import { inSentence } from "@/lib/catalog/words";

/**
 * @typedef {import("@/features/homepage/types").HomeSection} HomeSection
 */

const base = { enabled: true, description: "", limit: DEFAULT_SECTION_PRODUCTS, viewAllHref: "", showOnMobile: true, showOnDesktop: true };

/**
 * The layout every store starts with, built so products come first and the
 * catalogue is reachable in a few scrolls: category shortcuts, the hero, then
 * product rows (personal picks, the store's product types when it sells
 * several, one tabbed row instead of three stacked ones, recently viewed) and
 * the feed (60 products, then "View all"). Everything else
 * follows the feed: reassurance, quick filters, reviews, the call to action,
 * guides and sign-up. The category overview is desktop-only: on phones the
 * category circles already cover it.
 * @returns {HomeSection[]}
 */
export function defaultHomeSections() {
  return [
    { ...base, key: "category-nav", type: T.CATEGORY_NAV, title: "" },
    { ...base, key: "hero", type: T.HERO, title: "" },
    { ...base, key: "for-you", type: T.FOR_YOU, title: "Picked for you" },
    { ...base, key: "shop-by-type", type: T.SHOP_BY_TYPE, title: "Shop by type", limit: 10 },
    { ...base, key: "product-tabs", type: T.PRODUCT_TABS, title: "Shop the edit", tabs: ["bestsellers", "new", "trending"] },
    { ...base, key: "catalogue", type: T.CATALOGUE, title: "Explore the collection", viewAllHref: "/categories", showOnMobile: false },
    { ...base, key: "recently-viewed", type: T.RECENTLY_VIEWED, title: "Recently viewed" },
    { ...base, key: "feed", type: T.FEED, title: "All products", description: "", viewAllHref: "/products?sort=popular" },
    { ...base, key: "trust", type: T.TRUST, title: "", items: [] },
    { ...base, key: "quick-picks", type: T.QUICK_PICKS, title: "Find it faster" },
    { ...base, key: "reviews", type: T.REVIEWS, title: "What our buyers say", limit: 6 },
    { ...base, key: "cta", type: T.CTA, title: "", description: "" },
    { ...base, key: "guides", type: T.GUIDES, title: "Buying guides", limit: 4, viewAllHref: "/guides" },
    { ...base, key: "newsletter", type: T.NEWSLETTER, title: "New arrivals in your inbox", description: "Be first to see new arrivals, restocks and offers." },
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
        { icon: "badge", title: "Quality checked", text: "Every piece is checked before it ships." },
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
 * A saved layout, in the admin's order (the feed ends after 60 products, so
 * sections below it are reachable), plus any section type added since the
 * store saved it: admins can hide sections, not delete them. Additions go at
 * the end, or just before the feed when the feed is last, as older layouts had it.
 * @param {HomeSection[]} sections
 */
/**
 * Copy the layout shipped with while every store sold sarees only. Layouts
 * saved back then kept it word for word; once a store sells other kinds too
 * it reads wrong ("All sarees" above T-shirts), so it gives way to today's
 * defaults. Matching is exact, so text an admin wrote is never replaced.
 */
const LEGACY_SAREE_COPY = {
  feed: { title: "All sarees" },
  "quick-picks": { title: "Find your saree faster" },
  newsletter: { description: "Be first to see new weaves, restocks and offers." },
};
const LEGACY_TRUST_ITEM = { title: "Authentic weaves", text: "Every saree is checked before it ships." };

/**
 * @param {HomeSection[]} sections
 * @param {boolean} sareesOnly the store sells sarees only (lib/catalog/catalog-config.js sellsSareesOnly)
 * @returns {HomeSection[]}
 */
export function refreshLegacyCopy(sections, sareesOnly) {
  if (sareesOnly) return sections;
  const defaults = new Map(defaultHomeSections().map((section) => [section.key, section]));
  return sections.map((section) => {
    const legacy = LEGACY_SAREE_COPY[section.key];
    const current = defaults.get(section.key);
    let next = section;
    if (legacy && current) {
      for (const [field, text] of Object.entries(legacy)) {
        if (section[field] === text) next = { ...next, [field]: current[field] };
      }
    }
    if (section.type === T.TRUST && section.items?.some((item) => item.title === LEGACY_TRUST_ITEM.title && item.text === LEGACY_TRUST_ITEM.text)) {
      next = {
        ...next,
        items: section.items.map((item) =>
          item.title === LEGACY_TRUST_ITEM.title && item.text === LEGACY_TRUST_ITEM.text ? { ...item, title: "Quality checked", text: "Every piece is checked before it ships." } : item,
        ),
      };
    }
    return next;
  });
}

/**
 * The saved layout with the section types it predates added, without
 * duplicating any: each goes right after the section it follows in the
 * default layout ("Shop by type" after "Picked for you"), or first when none
 * of those is in the layout. The admin can move or turn them off afterwards.
 * @param {HomeSection[]} sections
 * @returns {HomeSection[]}
 */
export function normalizeHomeSections(sections) {
  const present = new Set(sections.map((section) => section.type));
  const keys = new Set(sections.map((section) => section.key));
  const defaults = defaultHomeSections();
  const missing = defaults.filter((section) => section.type !== T.COLLECTION && !present.has(section.type) && !keys.has(section.key));
  if (!missing.length) return sections;
  const result = [...sections];
  for (const section of missing) {
    const earlier = defaults.slice(0, defaults.indexOf(section)).reverse();
    const anchor = earlier.map((entry) => result.findIndex((item) => item.type === entry.type)).find((index) => index >= 0) ?? -1;
    result.splice(anchor + 1, 0, section);
  }
  return result;
}

/**
 * Section copy that names what the store sells. Wording kept from the
 * saree-only layout ("All sarees", "new weaves") stays only while the store
 * sells sarees alone; otherwise it gives way to today's defaults
 * (refreshLegacyCopy). One type reads "All T-shirts" and "Find your T-shirt
 * faster" where the layout has the generic or the old wording. Text an admin
 * wrote is never replaced.
 * @param {HomeSection[]} sections
 * @param {{ name: string, pluralName: string, template?: string }[]} types the types on sale with products
 * @returns {HomeSection[]}
 */
export function localizeHomeCopy(sections, types) {
  // No types yet means a store from before product types: a saree store.
  const sareesOnly = types.every((type) => type.template === "saree" || /^sarees?$/i.test(type.pluralName));
  const base = refreshLegacyCopy(sections, sareesOnly);
  if (types.length !== 1) return base;
  const [type] = types;
  const named = {
    feed: { from: ["All products", LEGACY_SAREE_COPY.feed.title], to: `All ${inSentence(type.pluralName)}` },
    "quick-picks": { from: ["Find it faster", LEGACY_SAREE_COPY["quick-picks"].title], to: `Find your ${inSentence(type.name)} faster` },
  };
  return base.map((section) => {
    const copy = named[section.key];
    return copy && copy.from.includes(section.title) ? { ...section, title: copy.to } : section;
  });
}
