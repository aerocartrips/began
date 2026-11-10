/**
 * Home page logic that needs no database: shopper interest ranking, feed
 * cursors, trending thresholds, bot filtering and the layout rules.
 */
import { describe, expect, it } from "vitest";
import { affinityFor, buildInterestProfile, rankRecommendations, strongestInterest } from "@/lib/catalog/interest";
import { decodeFeedCursor, encodeFeedCursor, feedCursorFilter } from "@/lib/catalog/cursor";
import { scoreProduct } from "@/lib/jobs/product-metrics.job";
import { isAutomatedRequest } from "@/lib/security/bot-detection";
import { homepageLayoutSchema } from "@/lib/validators/homepage.validator";
import { defaultHomeSections, normalizeHomeSections } from "@/lib/content/homepage-defaults";
import { PERMISSIONS, roleHasPermission } from "@/lib/auth/permissions";
import { MAX_SECTION_PRODUCTS, TRENDING_MIN_POINTS } from "@/lib/constants/homepage";

const id = (n) => n.toString(16).padStart(24, "0");
const silk = { category: "cat-silk", fabric: "Silk", weavingType: "Banarasi", occasion: "Wedding", colors: ["Red"], price: 3000 };
const cotton = { category: "cat-cotton", fabric: "Cotton", weavingType: "Handloom", occasion: "Daily", colors: ["Blue"], price: 800 };

describe("shopper interest", () => {
  it("weights stronger and more recent signals higher", () => {
    const profile = buildInterestProfile([
      { product: cotton, type: "view", rank: 0 },
      { product: silk, type: "wishlist", rank: 0 },
    ]);
    expect(profile.category["cat-silk"]).toBeGreaterThan(profile.category["cat-cotton"]);
    expect(strongestInterest(profile)).toEqual({ dimension: "category", value: "cat-silk" });

    const older = buildInterestProfile([{ product: silk, type: "view", rank: 5 }]);
    const newer = buildInterestProfile([{ product: silk, type: "view", rank: 0 }]);
    expect(older.total).toBeLessThan(newer.total);
  });

  it("scores matching products higher, case-insensitively, and ignores attributes with no history", () => {
    const profile = buildInterestProfile([{ product: silk, type: "view" }]);
    const similar = { ...silk, fabric: "SILK", category: "cat-silk", price: 3200 };
    expect(affinityFor(similar, profile)).toBeGreaterThan(0.9);
    expect(affinityFor(cotton, profile)).toBeLessThan(0.2);
    expect(affinityFor(silk, buildInterestProfile([]))).toBe(0);
  });

  it("excludes seen products, demotes out-of-stock ones and keeps the row varied", () => {
    const profile = buildInterestProfile([{ product: silk, type: "cart" }]);
    const candidates = [
      ...[1, 2, 3, 4].map((n) => ({ _id: id(n), ...silk, popularityScore: 10, stockQuantity: 5 })),
      { _id: id(5), ...cotton, popularityScore: 50, stockQuantity: 5 },
      { _id: id(6), ...silk, popularityScore: 100, stockQuantity: 0 },
    ];
    const ranked = rankRecommendations(candidates, profile, { limit: 4, exclude: new Set([id(1)]), maxPerCategory: 2 });
    const ids = ranked.map((doc) => doc._id);
    expect(ids).not.toContain(id(1));
    expect(ids).toHaveLength(4);
    // First pass allows two silk products, then a different category, then fills.
    expect(ranked.slice(0, 3).filter((doc) => doc.category === "cat-silk")).toHaveLength(2);
    expect(ids.slice(0, 3)).toContain(id(5));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("feed cursor", () => {
  it("round-trips and rejects tampered values", () => {
    const cursor = encodeFeedCursor({ popularityScore: 12.5, _id: id(42) });
    expect(decodeFeedCursor(cursor)).toEqual({ score: 12.5, id: id(42) });
    expect(decodeFeedCursor("not-a-cursor")).toBeNull();
    expect(decodeFeedCursor(Buffer.from(JSON.stringify({ s: -1, i: id(1) })).toString("base64url"))).toBeNull();
    expect(decodeFeedCursor(Buffer.from(JSON.stringify({ s: 1, i: "x" })).toString("base64url"))).toBeNull();
    expect(decodeFeedCursor("a".repeat(300))).toBeNull();
  });

  it("continues strictly after the cursor with an _id tiebreak", () => {
    expect(feedCursorFilter(null)).toEqual({});
    const filter = feedCursorFilter({ score: 3, id: id(9) });
    expect(filter.$or[0]).toEqual({ popularityScore: { $lt: 3 } });
    expect(filter.$or[1].popularityScore).toBe(3);
    expect(String(filter.$or[1]._id.$lt)).toBe(id(9));
  });
});

describe("trending", () => {
  it("is zero below the activity threshold, however fast it grows", () => {
    expect(scoreProduct({ decayed: 5, recent: TRENDING_MIN_POINTS - 1, baseline: 0 }).trendingScore).toBe(0);
  });

  it("boosts products rising above their own baseline", () => {
    const rising = scoreProduct({ decayed: 30, recent: 30, baseline: 0 }).trendingScore;
    const steady = scoreProduct({ decayed: 30, recent: 30, baseline: 90 }).trendingScore;
    expect(rising).toBeGreaterThan(steady);
    expect(rising).toBeLessThanOrEqual(30 * 3);
  });
});

describe("activity bot filter", () => {
  const browser = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36";
  const headers = (entries) => new Headers(entries);

  it("accepts same-origin browser requests", () => {
    expect(isAutomatedRequest(headers({ "user-agent": browser, "sec-fetch-site": "same-origin" }))).toBe(false);
  });

  it("rejects crawlers, scripts, prefetches and cross-site requests", () => {
    expect(isAutomatedRequest(headers({ "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" }))).toBe(true);
    expect(isAutomatedRequest(headers({ "user-agent": "curl/8.4.0" }))).toBe(true);
    expect(isAutomatedRequest(headers({}))).toBe(true);
    expect(isAutomatedRequest(headers({ "user-agent": browser, purpose: "prefetch" }))).toBe(true);
    expect(isAutomatedRequest(headers({ "user-agent": browser, "sec-fetch-site": "cross-site" }))).toBe(true);
  });
});

describe("home page layout", () => {
  const valid = () => ({ sections: defaultHomeSections() });

  it("accepts the default layout", () => {
    expect(homepageLayoutSchema.safeParse(valid()).success).toBe(true);
  });

  it("rejects duplicate singletons, duplicate keys and unsafe links", () => {
    const layout = valid();
    expect(homepageLayoutSchema.safeParse({ sections: [...layout.sections, { ...layout.sections[0], key: "other" }] }).success).toBe(false);
    expect(homepageLayoutSchema.safeParse({ sections: [...layout.sections, { ...layout.sections[0] }] }).success).toBe(false);
    const unsafe = valid();
    unsafe.sections[4].viewAllHref = "javascript:alert(1)";
    expect(homepageLayoutSchema.safeParse(unsafe).success).toBe(false);
  });

  it("requires collections to have a heading and a product source", () => {
    const collection = { key: "c1", type: "collection", title: "Bridal", source: { kind: "category", value: "" } };
    expect(homepageLayoutSchema.safeParse({ sections: [collection] }).success).toBe(false);
    expect(homepageLayoutSchema.safeParse({ sections: [{ ...collection, source: { kind: "category", value: "silk" } }] }).success).toBe(true);
    expect(homepageLayoutSchema.safeParse({ sections: [{ ...collection, source: { kind: "products", productIds: [] } }] }).success).toBe(false);
    expect(homepageLayoutSchema.safeParse({ sections: [{ ...collection, title: "", source: { kind: "fabric", value: "Silk" } }] }).success).toBe(false);
  });

  it("keeps the admin's order: the feed ends after 60 products, so it need not be last", () => {
    const reversed = defaultHomeSections().reverse();
    expect(normalizeHomeSections(reversed)).toEqual(reversed);
    // By default products come first: the feed is the last product section, and
    // reassurance, quick filters, reviews, the call to action, guides and sign-up follow it.
    const types = defaultHomeSections().map((section) => section.type);
    const feed = types.indexOf("feed");
    expect(types.slice(feed + 1)).toEqual(["trust", "quick-picks", "reviews", "cta", "guides", "newsletter"]);
  });

  it("adds section types a saved layout predates, without duplicating any", () => {
    const saved = defaultHomeSections().filter((section) => !["guides", "newsletter"].includes(section.type));
    const types = normalizeHomeSections(saved).map((section) => section.type);
    expect(types.slice(-2)).toEqual(["guides", "newsletter"]);
    expect(new Set(types).size).toBe(types.length);
    // Older layouts kept the feed last; additions still go above it there.
    const feedLast = [...saved.filter((section) => section.type !== "feed"), saved.find((section) => section.type === "feed")];
    expect(normalizeHomeSections(feedLast).map((section) => section.type).slice(-3)).toEqual(["guides", "newsletter", "feed"]);
  });

  it("caps product rows at 20 and shows the category overview on desktop only by default", () => {
    const sections = defaultHomeSections();
    expect(sections.find((section) => section.type === "for-you")?.limit).toBe(MAX_SECTION_PRODUCTS);
    expect(sections.find((section) => section.type === "catalogue")).toMatchObject({ showOnMobile: false, showOnDesktop: true });
    const tooMany = { sections: sections.map((section) => (section.type === "for-you" ? { ...section, limit: MAX_SECTION_PRODUCTS + 1 } : section)) };
    expect(homepageLayoutSchema.safeParse(tooMany).success).toBe(false);
  });

  it("is editable by owners and managers, not staff", () => {
    expect(roleHasPermission("owner", PERMISSIONS.MARKETING_MANAGE)).toBe(true);
    expect(roleHasPermission("manager", PERMISSIONS.MARKETING_MANAGE)).toBe(true);
    expect(roleHasPermission("staff", PERMISSIONS.MARKETING_MANAGE)).toBe(false);
  });
});
