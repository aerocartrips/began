import { z } from "zod";
import { AnalyticsDaily } from "@/lib/db/models/AnalyticsDaily";
import { Banner } from "@/lib/db/models/Banner";
import { Category } from "@/lib/db/models/Category";
import { Product } from "@/lib/db/models/Product";
import { ANALYTICS_BATCH_LIMIT, ANALYTICS_EVENTS, SECTION_CLICK_EVENTS } from "@/lib/constants/analytics";
import { HOME_SECTION_META, PRODUCT_RAIL_TYPES } from "@/lib/constants/homepage";
import { getAdminHomepageLayout } from "@/lib/services/homepage.service";
import { requireTenantId } from "@/lib/tenant/context";
import { ApiError } from "@/lib/utils/api-error";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_N = 10;

const eventSchema = z.object({
  event: z.enum(ANALYTICS_EVENTS),
  section: z.string().regex(/^[a-z0-9-]{0,40}$/).default(""),
  // Printable ASCII only: ids, slugs and paths. Free text (search terms) is never accepted.
  target: z.string().max(120).regex(/^[\x21-\x7e]*$/).default(""),
});
const batchSchema = z.object({ events: z.array(eventSchema).min(1).max(ANALYTICS_BATCH_LIMIT) });

const utcDay = (date = new Date()) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/**
 * Adds a batch of events to today's counters: one round trip, however many
 * events, with identical events merged first.
 * @param {unknown} payload `{ events: [{ event, section?, target? }] }`
 * @returns {Promise<{ recorded: number }>}
 */
export async function recordAnalyticsEvents(payload) {
  const parsed = batchSchema.safeParse(payload);
  if (!parsed.success) throw new ApiError(422, "Invalid analytics events.");
  const tenantId = requireTenantId();
  const day = utcDay();

  const counts = new Map();
  for (const { event, section, target } of parsed.data.events) {
    const key = JSON.stringify([event, section, target]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  await AnalyticsDaily.bulkWrite(
    [...counts].map(([key, count]) => {
      const [event, section, target] = JSON.parse(key);
      return {
        updateOne: {
          // bulkWrite skips the tenant-scope middleware, so the tenant is part of the filter (and the upserted document).
          filter: { tenantId, day, event, section, target },
          update: { $inc: { count } },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );
  return { recorded: parsed.data.events.length };
}

const top = (rows, event, limit = TOP_N) =>
  rows
    .filter((row) => row._id.event === event && row._id.target)
    .reduce((map, row) => map.set(row._id.target, (map.get(row._id.target) ?? 0) + row.count), new Map());

const sortedTop = (map, names) =>
  [...map]
    .map(([target, count]) => ({ target, label: names.get(target), count }))
    .filter((row) => row.label) // ids or slugs that no longer exist are dropped
    .sort((left, right) => right.count - left.count)
    .slice(0, TOP_N);

/**
 * Home page performance for the last `days` days: views and clicks per
 * section, top banners, categories and products, and shopper actions.
 * @param {{ days?: number }} [options]
 */
export async function getHomepageAnalytics({ days = 30 } = {}) {
  const span = Math.min(Math.max(Math.trunc(days) || 30, 1), 365);
  const since = utcDay(new Date(Date.now() - (span - 1) * DAY_MS));
  const rows = await AnalyticsDaily.aggregate([
    { $match: { day: { $gte: since } } },
    { $group: { _id: { event: "$event", section: "$section", target: "$target" }, count: { $sum: "$count" } } },
  ]);

  const { sections: layout } = await getAdminHomepageLayout();
  const sectionStats = new Map();
  for (const row of rows) {
    const { event, section, target } = row._id;
    if (!section) continue;
    const stat = sectionStats.get(section) ?? { views: 0, clicks: 0, halfway: 0, ends: 0 };
    if (event === "section_view") stat.views += row.count;
    if (SECTION_CLICK_EVENTS.includes(event)) stat.clicks += row.count;
    if (event === "rail_scroll" && target === "50") stat.halfway += row.count;
    if (event === "rail_scroll" && target === "100") stat.ends += row.count;
    sectionStats.set(section, stat);
  }
  /** Share of views, in percent with one decimal; null without views. */
  const rate = (count, views) => (views ? Math.round((count / views) * 1000) / 10 : null);
  const sections = layout
    .map((section) => {
      const stat = sectionStats.get(section.key) ?? { views: 0, clicks: 0, halfway: 0, ends: 0 };
      const rail = PRODUCT_RAIL_TYPES.includes(section.type);
      return {
        key: section.key,
        label: section.type === "collection" ? section.title || "Collection" : HOME_SECTION_META[section.type]?.label ?? section.type,
        enabled: section.enabled,
        views: stat.views,
        clicks: stat.clicks,
        clickRate: rate(stat.clicks, stat.views),
        // Product rows only: how many viewers swiped half way, and to the "View all" card.
        halfwayRate: rail ? rate(stat.halfway, stat.views) : null,
        endRate: rail ? rate(stat.ends, stat.views) : null,
      };
    });

  const bannerClicks = top(rows, "banner_click");
  const categoryClicks = top(rows, "category_click");
  const productClicks = top(rows, "product_click");
  const validIds = [...bannerClicks.keys()].filter((id) => /^[a-f\d]{24}$/i.test(id));
  const [banners, categories, products] = await Promise.all([
    validIds.length ? Banner.find({ _id: { $in: validIds } }).select("name").lean() : [],
    categoryClicks.size ? Category.find({ slug: { $in: [...categoryClicks.keys()] } }).select("name slug").lean() : [],
    productClicks.size ? Product.find({ slug: { $in: [...productClicks.keys()] } }).select("name slug").lean() : [],
  ]);

  const total = (event, target) =>
    rows
      .filter((row) => row._id.event === event && (target === undefined || row._id.target === target))
      .reduce((sum, row) => sum + row.count, 0);
  return {
    days: span,
    since: since.toISOString(),
    sections,
    topBanners: sortedTop(bannerClicks, new Map(banners.map((banner) => [String(banner._id), banner.name]))),
    topCategories: sortedTop(categoryClicks, new Map(categories.map((category) => [category.slug, category.name]))),
    topProducts: sortedTop(productClicks, new Map(products.map((product) => [product.slug, product.name]))),
    actions: {
      searches: total("search_submit"),
      suggestionClicks: total("search_suggestion_click"),
      wishlistAdds: total("wishlist_add"),
      cartAdds: total("cart_add"),
      feedLoads: total("feed_load"),
      viewAllHeader: total("view_all_click", "header"),
      viewAllEnd: total("view_all_click", "end"),
      newsletterSignups: total("newsletter_signup"),
    },
  };
}
