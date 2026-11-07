/**
 * Home page data: category overview, feed pagination, demand metrics,
 * activity de-duplication, recommendations, layout configuration and store
 * isolation, against a real MongoDB.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo;
let m;
let storeA;
let storeB;
let silk;
let banarasi;
let cotton;
/** @type {Record<string, any>} */
const products = {};
const DAY = 24 * 60 * 60 * 1000;
const admin = { _id: new mongoose.Types.ObjectId() };

async function makeProduct(tenantId, n, overrides = {}) {
  return m.runWithTenant(tenantId, () =>
    m.Product.create({
      name: `Saree ${n}`,
      slug: `saree-${n}`,
      sku: `SKU-${n}`,
      category: silk._id,
      fabric: "Silk",
      price: 1000 + n * 10,
      wholesalePrice: 700 + n * 10,
      minimumOrderQuantity: 5,
      stockQuantity: 20,
      status: "active",
      ...overrides,
    }),
  );
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("norosilk_home_test");
  await (await import("@/lib/db/connect")).connectDB();
  m = {
    Tenant: (await import("@/lib/db/models/Tenant")).Tenant,
    Category: (await import("@/lib/db/models/Category")).Category,
    Product: (await import("@/lib/db/models/Product")).Product,
    Order: (await import("@/lib/db/models/Order")).Order,
    ProductActivity: (await import("@/lib/db/models/ProductActivity")).ProductActivity,
    ...(await import("@/lib/tenant/context")),
    ...(await import("@/lib/catalog/home")),
    ...(await import("@/lib/catalog/recommendations")),
    ...(await import("@/lib/jobs/product-metrics.job")),
    ...(await import("@/lib/services/product-activity.service")),
    ...(await import("@/lib/services/homepage.service")),
    ...(await import("@/lib/content/homepage")),
  };
  storeA = String((await m.Tenant.create({ slug: "a", name: "A", domains: ["a.test"] }))._id);
  storeB = String((await m.Tenant.create({ slug: "b", name: "B", domains: ["b.test"] }))._id);

  await m.runWithTenant(storeA, async () => {
    silk = await m.Category.create({ name: "Silk", slug: "silk", sortOrder: 1 });
    banarasi = await m.Category.create({ name: "Banarasi", slug: "banarasi", parentCategory: silk._id, sortOrder: 2 });
    cotton = await m.Category.create({ name: "Cotton", slug: "cotton", sortOrder: 3 });
    await m.Category.create({ name: "Empty", slug: "empty", sortOrder: 4 });
  });
  for (let n = 1; n <= 20; n += 1) products[n] = await makeProduct(storeA, n);
  for (let n = 21; n <= 25; n += 1) products[n] = await makeProduct(storeA, n, { category: banarasi._id, weavingType: "Banarasi" });
  for (let n = 26; n <= 30; n += 1) products[n] = await makeProduct(storeA, n, { category: cotton._id, fabric: "Cotton", price: 400 + n, wholesalePrice: 300 + n });
  products.draft = await makeProduct(storeA, 99, { status: "draft" });
  // Another store's product in a same-named category must never leak in.
  await m.runWithTenant(storeB, async () => {
    const other = await m.Category.create({ name: "Silk", slug: "silk" });
    await m.Product.create({ name: "Other store", slug: "other", sku: "OTHER", category: other._id, price: 1, wholesalePrice: 1, status: "active", stockQuantity: 1 });
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe("catalogue at a glance", () => {
  it("rolls subcategories into top-level categories and skips empty ones", async () => {
    const overview = await m.getCategoryOverview(storeA, "wholesale");
    expect(overview.map((category) => [category.slug, category.productCount])).toEqual([
      ["silk", 25],
      ["cotton", 5],
    ]);
    expect(overview[0].startingPrice).toBe(710); // wholesale price of Saree 1
    expect(overview[1].startingPrice).toBe(326);
    expect((await m.getCategoryOverview(storeA, "retail"))[1].startingPrice).toBe(426);
  });
});

describe("home feed", () => {
  async function readAll(category = "") {
    const seen = [];
    let cursor = null;
    for (let guard = 0; guard < 20; guard += 1) {
      const page = await m.getFeedPage(storeA, "retail", category, cursor);
      seen.push(...page.items.map((item) => item.id));
      if (!page.nextCursor) return seen;
      cursor = page.nextCursor;
    }
    throw new Error("Feed did not end");
  }

  it("pages through every active product exactly once, then ends", async () => {
    const ids = await readAll();
    expect(ids).toHaveLength(30);
    expect(new Set(ids).size).toBe(30);
    expect(ids).not.toContain(String(products.draft._id));
  });

  it("filters by category including subcategories, and stays inside the store", async () => {
    expect(await readAll("silk")).toHaveLength(25);
    expect(await readAll("cotton")).toHaveLength(5);
    expect(await readAll("unknown")).toHaveLength(0);
    const storeBFeed = await m.getFeedPage(storeB, "retail", "", null);
    expect(storeBFeed.items.map((item) => item.name)).toEqual(["Other store"]);
  });

  it("treats a malformed cursor as the first page", async () => {
    const first = await m.getFeedPage(storeA, "retail", "", null);
    const garbage = await m.getFeedPage(storeA, "retail", "", "%%%");
    expect(garbage.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
  });
});

describe("shopper activity", () => {
  it("counts each client once per product and type, and ignores inactive products", async () => {
    await m.runWithTenant(storeA, async () => {
      const productId = String(products[3]._id);
      expect(await m.recordProductActivity({ productId, type: "view" }, "client-1")).toEqual({ counted: true });
      expect(await m.recordProductActivity({ productId, type: "view" }, "client-1")).toEqual({ counted: false });
      expect(await m.recordProductActivity({ productId, type: "cart" }, "client-1")).toEqual({ counted: true });
      expect(await m.recordProductActivity({ productId, type: "view" }, "client-2")).toEqual({ counted: true });
      expect(await m.recordProductActivity({ productId: String(products.draft._id), type: "view" }, "client-3")).toEqual({ counted: false });
      await expect(m.recordProductActivity({ productId: "nope", type: "view" }, "client-1")).rejects.toThrow();

      const [row] = await m.ProductActivity.find({ product: productId }).lean();
      expect(row).toMatchObject({ views: 2, carts: 1, wishlists: 0 });
    });
  });
});

describe("demand metrics", () => {
  it("derives best sellers from paid orders only, and popularity and trending from activity", async () => {
    const now = Date.now();
    const order = (tenantId, productIds, daysAgo, paymentStatus = "paid", orderStatus = "confirmed") => ({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      orderNumber: `ORD-${Math.random()}`,
      customer: new mongoose.Types.ObjectId(),
      items: productIds.map((product) => ({ product: product._id, productName: "x", sku: "x", quantity: 10, unitPrice: 1, lineTotal: 10 })),
      paymentStatus,
      orderStatus,
      createdAt: new Date(now - daysAgo * DAY),
    });
    await m.Order.collection.insertMany([
      order(storeA, [products[5], products[6]], 2),
      order(storeA, [products[5]], 10),
      order(storeA, [products[5]], 40),
      order(storeA, [products[6]], 1, "pending"),
      order(storeA, [products[7]], 1, "paid", "cancelled"),
      order(storeA, [products[8]], 200),
    ]);
    // A burst of recent interest on product 9, none before.
    await m.runWithTenant(storeA, () =>
      m.ProductActivity.create({ product: products[9]._id, day: new Date(now - DAY), views: 20, wishlists: 2, carts: 1 }),
    );

    const before = await m.getProductTabs(storeA, "retail", 10);
    expect(before.bestsellers).toHaveLength(0);
    expect(before.trending).toHaveLength(0);
    expect(before.new).toHaveLength(10);

    await m.runWithTenant(storeA, () => m.recomputeProductMetrics());
    const tabs = await m.getProductTabs(storeA, "retail", 10);
    expect(tabs.bestsellers.map((item) => item.name)).toEqual(["Saree 5", "Saree 6"]);
    expect(tabs.trending[0].name).toBe("Saree 9");
    expect(tabs.trending.map((item) => item.name)).not.toContain("Saree 3"); // below the threshold

    await m.runWithTenant(storeA, async () => {
      const doc = await m.Product.findById(products[5]._id).lean();
      expect(doc.salesCount).toBe(3);
      expect(doc.popularityScore).toBeGreaterThan(0);
      expect((await m.Product.findById(products[8]._id).lean()).salesCount).toBe(0); // outside the window
    });
    // The feed now leads with the most in-demand product.
    expect((await m.getFeedPage(storeA, "retail", "", null)).items[0].name).toBe("Saree 9");

    // Another store's products are untouched.
    await m.runWithTenant(storeB, async () => {
      const other = await m.Product.findOne({ slug: "other" }).lean();
      expect(other.popularityScore).toBe(0);
    });
  });

  it("resets products whose demand has lapsed", async () => {
    await m.runWithTenant(storeA, async () => {
      await m.ProductActivity.deleteMany({});
      await m.Order.deleteMany({});
      await m.recomputeProductMetrics();
      expect(await m.Product.countDocuments({ $or: [{ popularityScore: { $gt: 0 } }, { salesCount: { $gt: 0 } }] })).toBe(0);
    });
  });
});

describe("recommendations", () => {
  it("falls back to popular products for shoppers without history", async () => {
    const result = await m.getRecommendations(storeA, "retail", { limit: 6 });
    expect(result.personalized).toBe(false);
    expect(result.items).toHaveLength(6);
  });

  it("follows the shopper's interest and excludes what they already saw", async () => {
    const viewed = [26, 27].map((n) => String(products[n]._id));
    const result = await m.getRecommendations(storeA, "retail", { viewedIds: viewed, limit: 4 });
    expect(result.personalized).toBe(true);
    expect(result.reason).toBe("Based on your interest in Cotton");
    const ids = result.items.map((item) => item.id);
    expect(ids.some((itemId) => viewed.includes(itemId))).toBe(false);
    // Remaining cotton sarees rank first (diversity allows two per category before filling).
    expect(result.items.slice(0, 2).every((item) => /Saree (28|29|30)/.test(item.name))).toBe(true);
  });

  it("ignores ids from another store", async () => {
    const otherId = await m.runWithTenant(storeB, async () => String((await m.Product.findOne({ slug: "other" }).lean())._id));
    const result = await m.getRecommendations(storeA, "retail", { viewedIds: [otherId], limit: 4 });
    expect(result.personalized).toBe(false);
  });
});

describe("home page layout", () => {
  it("uses the default layout until the store saves its own", async () => {
    const types = (await m.getHomepageSections(storeA)).map((section) => section.type);
    // Products first; reassurance and sign-up after the feed, which ends after 60 products.
    expect(types.slice(0, 4)).toEqual(["category-nav", "hero", "for-you", "product-tabs"]);
    expect(types.indexOf("feed")).toBeLessThan(types.indexOf("newsletter"));
    await m.runWithTenant(storeA, async () => expect((await m.getAdminHomepageLayout()).isDefault).toBe(true));
  });

  it("saves order, visibility and collections per store, in the admin's order", async () => {
    await m.runWithTenant(storeA, async () => {
      const { sections } = await m.getAdminHomepageLayout();
      const feed = sections.find((section) => section.type === "feed");
      const reviews = { ...sections.find((section) => section.type === "reviews"), enabled: false };
      const hero = sections.find((section) => section.type === "hero");
      const collection = {
        key: "collection-bridal",
        type: "collection",
        title: "Bridal picks",
        showOnDesktop: false,
        source: { kind: "products", productIds: [String(products[2]._id), String(products[1]._id)] },
      };
      await m.saveHomepageLayout({ sections: [feed, collection, hero, reviews] }, admin);
    });

    const visible = await m.getHomepageSections(storeA);
    const types = visible.map((section) => section.type);
    // Saved order first (the feed may lead); section types the store never saw are added (enabled) after it.
    expect(types.slice(0, 3)).toEqual(["feed", "collection", "hero"]);
    expect(types).not.toContain("reviews"); // hidden by the admin
    expect(types).toEqual(expect.arrayContaining(["guides", "newsletter", "for-you"]));
    expect(visible[1]).toMatchObject({ showOnDesktop: false, showOnMobile: true });
    const picks = await m.getCollectionProducts(storeA, "retail", visible[1].source, 10);
    expect(picks.items.map((item) => item.name)).toEqual(["Saree 2", "Saree 1"]);
    expect(picks.total).toBe(2);

    // Store B is unaffected.
    expect((await m.getHomepageSections(storeB)).length).toBeGreaterThan(3);

    await m.runWithTenant(storeA, async () => {
      await expect(m.saveHomepageLayout({ sections: [{ key: "x", type: "collection", title: "", source: { kind: "fabric" } }] }, admin)).rejects.toThrow();
      await m.resetHomepageLayout();
    });
    expect((await m.getHomepageSections(storeA)).length).toBeGreaterThan(3);
  });

  it("builds collections from categories and attributes, with the full count for View all", async () => {
    const byCategory = await m.getCollectionProducts(storeA, "retail", { kind: "category", value: "silk", productIds: [], sort: "newest" }, 30);
    expect(byCategory.items).toHaveLength(25);
    const capped = await m.getCollectionProducts(storeA, "retail", { kind: "category", value: "silk", productIds: [], sort: "newest" }, 10);
    expect(capped.items).toHaveLength(10);
    expect(capped.total).toBe(25);
    const byWeave = await m.getCollectionProducts(storeA, "retail", { kind: "weave", value: "Banarasi", productIds: [], sort: "price-asc" }, 10);
    expect(byWeave.items.map((item) => item.name)).toEqual(["Saree 21", "Saree 22", "Saree 23", "Saree 24", "Saree 25"]);
    expect(await m.getCatalogueTotal(storeA)).toBe(30);
  });
});

describe("quick picks", () => {
  it("offers only values products actually have, with real counts", async () => {
    const groups = await m.getQuickPicks(storeA, "retail");
    const fabric = groups.find((group) => group.key === "fabric");
    expect(fabric.links).toEqual([
      { label: "Silk", href: "/products?fabric=Silk", count: 25 },
      { label: "Cotton", href: "/products?fabric=Cotton", count: 5 },
    ]);
    expect(groups.find((group) => group.key === "weave")).toBeUndefined(); // only one weave value
    expect(groups.find((group) => group.key === "price")?.links.length).toBeGreaterThanOrEqual(2);
  });
});
