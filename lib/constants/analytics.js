/**
 * First-party storefront analytics: daily counts per event, section and
 * target (banner id, category or product slug, link path). No visitor ids,
 * IPs, search terms or other personal data are stored.
 */
export const ANALYTICS_EVENTS = [
  "section_view",
  "banner_click",
  "category_click",
  "product_click",
  "link_click",
  "search_submit",
  "search_suggestion_click",
  "wishlist_add",
  "cart_add",
  "feed_load",
  "newsletter_signup",
];

/** Events that count as a click on a home page section, for click-through rates. */
export const SECTION_CLICK_EVENTS = ["banner_click", "category_click", "product_click", "link_click"];

export const ANALYTICS_BATCH_LIMIT = 25;
export const ANALYTICS_RETENTION_DAYS = 400;
