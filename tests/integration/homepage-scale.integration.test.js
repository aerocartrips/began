/**
 * Home page reads on a large catalogue (20,000 products): the feed must walk
 * the whole catalogue without duplicates or gaps using index-ordered reads
 * (no in-memory sort, bounded documents examined per page), and the overview
 * aggregations must stay fast.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const PRODUCTS = 20000;
const CATEGORIES = 20;
let mongo;
let m;
let tenantId;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("norosilk_home_scale_test");
  await (await import("@/lib/db/connect")).connectDB();
  m = {
    Tenant: (await import("@/lib/db/models/Tenant")).Tenant,
    Category: (await import("@/lib/db/models/Category")).Category,
    Product: (await import("@/lib/db/models/Product")).Product,
    ...(await import("@/lib/tenant/context")),
    ...(await import("@/lib/catalog/home")),
    ...(await import("@/lib/catalog/cursor")),
  };
  await m.Product.init();
  tenantId = (await m.Tenant.create({ slug: "big", name: "Big", domains: ["big.test"] }))._id;
  const categories = await m.runWithTenant(String(tenantId), () =>
    m.Category.insertMany(Array.from({ length: CATEGORIES }, (_, index) => ({ name: `Category ${index}`, slug: `category-${index}`, tenantId }))),
  );
  const fabrics = ["Silk", "Cotton", "Organza", "Linen"];
  const docs = Array.from({ length: PRODUCTS }, (_, index) => ({
    tenantId,
    name: `Saree ${index}`,
    nameLower: `saree ${index}`,
    slug: `saree-${index}`,
    sku: `SKU-${index}`,
    category: categories[index % CATEGORIES]._id,
    fabric: fabrics[index % fabrics.length],
    price: 500 + (index % 400) * 10,
    wholesalePrice: 300 + (index % 400) * 8,
    minimumOrderQuantity: 1,
    stockQuantity: index % 7,
    // Many ties, so pagination depends on the _id tiebreak.
    popularityScore: index % 50,
    status: index % 25 === 0 ? "draft" : "active",
    images: [],
    variants: [],
    createdAt: new Date(Date.now() - index * 60000),
    updatedAt: new Date(),
  }));
  for (let index = 0; index < docs.length; index += 5000) await m.Product.collection.insertMany(docs.slice(index, index + 5000));
}, 240000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

const active = PRODUCTS - PRODUCTS / 25;

describe("feed on 20,000 products", () => {
  it("returns every active product exactly once across ~1,600 pages", async () => {
    const seen = new Set();
    let cursor = null;
    let pages = 0;
    let slowest = 0;
    do {
      const started = performance.now();
      const page = await m.getFeedPage(String(tenantId), "retail", "", cursor);
      slowest = Math.max(slowest, performance.now() - started);
      for (const item of page.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 5000);
    expect(seen.size).toBe(active);
    expect(cursor).toBeNull();
    // Deep pages cost the same as the first (keyset, not skip). Generous bound for slow CI machines.
    expect(slowest).toBeLessThan(500);
  }, 180000);

  it("reads deep pages from the index without sorting in memory", async () => {
    const position = { score: 7, id: new mongoose.Types.ObjectId().toHexString() };
    const explain = await m.runWithTenant(String(tenantId), () =>
      m.Product.find({ status: "active", ...m.feedCursorFilter(position) })
        .sort({ popularityScore: -1, _id: -1 })
        .limit(13)
        .explain("executionStats"),
    );
    const plan = JSON.stringify(explain.queryPlanner.winningPlan);
    expect(plan).not.toMatch(/"stage":"SORT"/);
    expect(plan).toMatch(/IXSCAN/);
    expect(explain.executionStats.totalDocsExamined).toBeLessThan(200);
  });

  it("filters a category without scanning the catalogue", async () => {
    const started = performance.now();
    const page = await m.getFeedPage(String(tenantId), "retail", "category-3", null);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(page.items).toHaveLength(12);
  });
});

describe("overview aggregations on 20,000 products", () => {
  it("builds the catalogue overview and quick picks quickly and correctly", async () => {
    let started = performance.now();
    const overview = await m.getCategoryOverview(String(tenantId), "wholesale");
    const overviewMs = performance.now() - started;
    expect(overview).toHaveLength(CATEGORIES);
    expect(overview.reduce((sum, category) => sum + category.productCount, 0)).toBe(active);

    started = performance.now();
    const picks = await m.getQuickPicks(String(tenantId), "retail");
    const picksMs = performance.now() - started;
    expect(picks.find((group) => group.key === "fabric").links.reduce((sum, link) => sum + link.count, 0)).toBe(active);

    expect(overviewMs).toBeLessThan(3000);
    expect(picksMs).toBeLessThan(3000);
    console.info(`20k products: overview ${overviewMs.toFixed(0)} ms, quick picks ${picksMs.toFixed(0)} ms`);
  });
});
