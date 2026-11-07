/**
 * Home page sections and the shopper-interest model behind them.
 * The layout itself is stored per store (HomepageLayout) and edited in
 * Admin → Home page; these are the building blocks and their defaults.
 */

export const HOME_SECTION_TYPES = {
  CATEGORY_NAV: "category-nav",
  HERO: "hero",
  TRUST: "trust",
  FOR_YOU: "for-you",
  CATALOGUE: "catalogue",
  PRODUCT_TABS: "product-tabs",
  QUICK_PICKS: "quick-picks",
  COLLECTION: "collection",
  RECENTLY_VIEWED: "recently-viewed",
  REVIEWS: "reviews",
  CTA: "cta",
  GUIDES: "guides",
  NEWSLETTER: "newsletter",
  FEED: "feed",
};

export const HOME_SECTION_TYPE_VALUES = Object.values(HOME_SECTION_TYPES);

/**
 * Product rows hold up to 20 cards and end in a "View all" card: enough to
 * browse in one swipe, without loading photos most shoppers never reach.
 */
export const MAX_SECTION_PRODUCTS = 20;
export const DEFAULT_SECTION_PRODUCTS = 20;
/**
 * The feed loads 20 products at a time, at most 3 times (60 products), then
 * links to the full catalogue, so the sections and footer below it stay reachable.
 */
export const FEED_PAGE_SIZE = 20;
export const FEED_MAX_PAGES = 3;

/** Admin-facing names and help text for each section type. */
export const HOME_SECTION_META = {
  [HOME_SECTION_TYPES.CATEGORY_NAV]: { label: "Category circles", help: "Round category shortcuts under the header." },
  [HOME_SECTION_TYPES.HERO]: { label: "Hero banners", help: "Slides from Admin → Banners. Falls back to the store headline." },
  [HOME_SECTION_TYPES.TRUST]: { label: "Trust strip", help: "Short reasons to buy from you." },
  [HOME_SECTION_TYPES.FOR_YOU]: { label: "Picked for you", help: "Personalised from each shopper's views, wishlist, cart and orders. New visitors see popular products." },
  [HOME_SECTION_TYPES.CATALOGUE]: { label: "Catalogue at a glance", help: "Every category with its product count, starting price and preview photos." },
  [HOME_SECTION_TYPES.PRODUCT_TABS]: { label: "Best sellers / New / Trending", help: "One tabbed row. Tabs without real data are hidden automatically." },
  [HOME_SECTION_TYPES.QUICK_PICKS]: { label: "Quick picks", help: "One-tap filters by fabric, weave, occasion and price band." },
  [HOME_SECTION_TYPES.COLLECTION]: { label: "Product collection", help: "A row of products from a category, attribute or your own picks." },
  [HOME_SECTION_TYPES.RECENTLY_VIEWED]: { label: "Recently viewed", help: "Shown only to shoppers who have viewed products on this device." },
  [HOME_SECTION_TYPES.REVIEWS]: { label: "Customer reviews", help: "Approved 4★+ reviews from verified buyers. Hidden when there are none." },
  [HOME_SECTION_TYPES.CTA]: { label: "Call to action", help: "A banner for bulk orders or enquiries." },
  [HOME_SECTION_TYPES.GUIDES]: { label: "Buying guides", help: "Latest published guides with a cover photo. Hidden when there are none." },
  [HOME_SECTION_TYPES.NEWSLETTER]: { label: "Newsletter sign-up", help: "Email sign-up with confirmation by email." },
  [HOME_SECTION_TYPES.FEED]: {
    label: "All products feed",
    help: `Up to ${FEED_PAGE_SIZE * FEED_MAX_PAGES} products, ${FEED_PAGE_SIZE} at a time as shoppers scroll, then a link to the full catalogue.`,
  },
};

/** Sections drawn as swipeable product rows (components/catalog/product-rail.tsx). */
export const PRODUCT_RAIL_TYPES = [
  HOME_SECTION_TYPES.FOR_YOU,
  HOME_SECTION_TYPES.PRODUCT_TABS,
  HOME_SECTION_TYPES.COLLECTION,
  HOME_SECTION_TYPES.RECENTLY_VIEWED,
];

export const PRODUCT_TAB_KEYS = ["bestsellers", "new", "trending"];
export const PRODUCT_TAB_LABELS = { bestsellers: "Best sellers", new: "New arrivals", trending: "Trending" };

export const COLLECTION_SOURCE_KINDS = ["category", "products", "fabric", "weave", "occasion"];
export const COLLECTION_SORTS = ["popular", "newest", "price-asc"];

export const TRUST_ICONS = ["boxes", "file", "badge", "truck", "shield", "sparkles", "refresh"];

export const MAX_HOME_SECTIONS = 30;
export const MAX_COLLECTIONS = 12;

/**
 * Store-wide popularity (lib/jobs/product-metrics.job.js). Points per event;
 * older events count less (half-life), so popularity follows current demand.
 */
export const POPULARITY_WEIGHTS = { view: 1, wishlist: 4, cart: 6, order: 10 };
export const POPULARITY_HALF_LIFE_DAYS = 14;
export const POPULARITY_WINDOW_DAYS = 60;
export const BESTSELLER_WINDOW_DAYS = 90;
export const TRENDING_WINDOW_DAYS = 7;
/**
 * Minimum weighted activity in the trending window before a product may be
 * called trending: about a dozen shoppers viewing it, or a sale plus some interest.
 */
export const TRENDING_MIN_POINTS = 12;

/** Per-shopper interest (lib/catalog/recommendations.js). */
export const INTEREST_WEIGHTS = { view: 1, wishlist: 4, cart: 5, purchase: 6 };
