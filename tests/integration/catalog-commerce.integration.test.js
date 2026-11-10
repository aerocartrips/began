/**
 * Catalogue search, cart pricing, variant stock reservation and quotes against
 * an in-memory MongoDB, with two stores to prove catalogue isolation.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

vi.mock("@/lib/services/email.service", () => ({ sendTransactionalEmail: vi.fn(async () => ({ sent: false })) }));

let replSet;
let m;
let wholesale;
let retail;
let product;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri("norosilk_catalog_test");
  await (await import("@/lib/db/connect")).connectDB();
  m = {
    Tenant: (await import("@/lib/db/models/Tenant")).Tenant,
    Product: (await import("@/lib/db/models/Product")).Product,
    Category: (await import("@/lib/db/models/Category")).Category,
    ...(await import("@/lib/tenant/context")),
    ...(await import("@/lib/catalog/query")),
    ...(await import("@/lib/services/cart-pricing.service")),
    ...(await import("@/lib/services/order.service")),
    ...(await import("@/lib/services/inventory.service")),
    Order: (await import("@/lib/db/models/Order")).Order,
    StockMovement: (await import("@/lib/db/models/StockMovement")).StockMovement,
    ...(await import("@/lib/services/quote.service")),
  };
  await Promise.all([m.Product.syncIndexes(), m.Category.syncIndexes()]);
  wholesale = await m.Tenant.create({ slug: "w", name: "Wholesale Co", domains: ["w.test"], salesMode: "wholesale" });
  retail = await m.Tenant.create({ slug: "r", name: "Retail Co", domains: ["r.test"], salesMode: "retail" });

  const catalogues = [
    [wholesale, ["Banarasi Silk Red", "Banarasi Silk Blue", "Cotton Daily"]],
    [retail, ["Retail Only Linen"]],
  ];
  for (const [tenant, names] of catalogues) {
    await m.runWithTenant(tenant, async () => {
      const category = await m.Category.create({ name: "Sarees", slug: "sarees" });
      for (const [index, name] of names.entries()) {
        const created = await m.Product.create({
          name,
          slug: name.toLowerCase().replace(/\s+/g, "-"),
          sku: `SKU-${tenant.slug}-${index}`,
          category: category._id,
          fabric: name.includes("Cotton") ? "Cotton" : "Silk",
          price: 1000,
          compareAtPrice: 1200,
          wholesalePrice: 700,
          minimumOrderQuantity: 10,
          bulkPricingTiers: [{ minQuantity: 50, pricePerUnit: 650 }],
          variants: [
            { colorName: "Red", colorHex: "#aa0000", sku: `V-${tenant.slug}-${index}-R`, stockQuantity: 60 },
            { colorName: "Gold", colorHex: "#c9a227", sku: `V-${tenant.slug}-${index}-G`, stockQuantity: 0 },
          ],
          status: "active",
        });
        if (tenant === wholesale && index === 0) product = created;
      }
    });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

describe("catalogue search", () => {
  it("derives totals from variants and returns facets for one store only", async () => {
    expect(product.stockQuantity).toBe(60);
    expect(product.colors).toEqual(["Red", "Gold"]);
    const result = await m.searchCatalog(String(wholesale._id), "wholesale", m.parseCatalogQuery({}));
    expect(result.total).toBe(3);
    expect(result.facets.fabric).toEqual(expect.arrayContaining([{ value: "Silk", count: 2 }, { value: "Cotton", count: 1 }]));
    expect(result.items.every((item) => item.price === 700 && item.minimumQuantity === 10)).toBe(true);
  });

  it("keeps counts for other values when one value of a filter is selected", async () => {
    const result = await m.searchCatalog(String(wholesale._id), "wholesale", m.parseCatalogQuery({ fabric: "Cotton" }));
    expect(result.total).toBe(1);
    expect(result.facets.fabric.find((facet) => facet.value === "Silk")?.count).toBe(2);
  });

  it("lists values that differ only in letter case as one option and matches them whatever the case", async () => {
    // A store of its own, so the totals the other tests check stay as they are.
    const store = await m.Tenant.create({ slug: "c", name: "Cased Co", domains: ["c.test"], salesMode: "wholesale" });
    await m.runWithTenant(store, async () => {
      const category = await m.Category.create({ name: "Sarees", slug: "sarees" });
      const fabrics = ["Pure Silk", "Pure Silk", "pure silk", "Cotton+Silk", "Linen"];
      for (const [index, fabric] of fabrics.entries()) {
        await m.Product.create({
          name: `Cased ${index}`,
          slug: `cased-${index}`,
          sku: `SKU-c-${index}`,
          category: category._id,
          fabric,
          price: 1000 + index * 100,
          wholesalePrice: 500 + index * 100,
          minimumOrderQuantity: 1,
          variants: [{ colorName: "Red", colorHex: "#aa0000", sku: `V-c-${index}`, stockQuantity: 5 }],
          status: "active",
        });
      }
    });

    const all = await m.searchCatalog(String(store._id), "wholesale", m.parseCatalogQuery({}));
    // One option per value, shown in its most common spelling, most products first.
    expect(all.facets.fabric).toEqual([
      { value: "Pure Silk", count: 3 },
      { value: "Cotton+Silk", count: 1 },
      { value: "Linen", count: 1 },
    ]);
    expect(all.priceRange).toEqual({ min: 500, max: 900 });

    const silk = await m.searchCatalog(String(store._id), "wholesale", m.parseCatalogQuery({ fabric: "pure SILK" }));
    expect(silk.total).toBe(3);
    expect(silk.priceRange).toEqual({ min: 500, max: 700 });
    // Whole values only, with regex characters taken literally.
    const blend = await m.searchCatalog(String(store._id), "wholesale", m.parseCatalogQuery({ fabric: "cotton+silk" }));
    expect(blend.items.map((item) => item.name)).toEqual(["Cased 3"]);
    const partial = await m.searchCatalog(String(store._id), "wholesale", m.parseCatalogQuery({ fabric: "Silk" }));
    expect(partial.total).toBe(0);
  });

  it("matches word searches and name prefixes", async () => {
    const words = await m.searchCatalog(String(wholesale._id), "wholesale", m.parseCatalogQuery({ q: "banarasi" }));
    const prefix = await m.searchCatalog(String(wholesale._id), "wholesale", m.parseCatalogQuery({ q: "bana" }));
    expect(words.total).toBe(2);
    expect(prefix.total).toBe(2);
  });

  it("shows retail prices in a retail store and never another store's products", async () => {
    const result = await m.searchCatalog(String(retail._id), "retail", m.parseCatalogQuery({}));
    expect(result.items.map((item) => item.name)).toEqual(["Retail Only Linen"]);
    expect(result.items[0]).toMatchObject({ price: 1000, compareAtPrice: 1200, minimumQuantity: 1 });
  });
});

describe("cart pricing and stock", () => {
  const red = () => String(product.variants[0]._id);
  const gold = () => String(product.variants[1]._id);

  it("applies MOQ, tiers and per-colour stock in the wholesale store", async () => {
    const priced = await m.runWithTenant(wholesale, () =>
      m.priceCartItems([
        { productId: String(product._id), variantId: red(), quantity: 5 },
        { productId: String(product._id), variantId: gold(), quantity: 10 },
      ]),
    );
    expect(priced.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([expect.stringMatching(/Minimum order quantity/), expect.stringMatching(/out of stock/)]),
    );
    const tiered = await m.runWithTenant(wholesale, () =>
      m.priceCartItems([{ productId: String(product._id), variantId: red(), quantity: 50 }]),
    );
    expect(tiered.lines[0]).toMatchObject({ unitPrice: 650, lineTotal: 32500, colorName: "Red" });
  });

  it("reserves and releases stock per colour atomically, once, with a ledger entry each way", async () => {
    await m.runWithTenant(wholesale, async () => {
      const address = { fullName: "Asha Buyer", phone: "9876543210", addressLine1: "12 Silk Road", city: "Bengaluru", state: "Karnataka", pincode: "560001", country: "India" };
      const order = await m.Order.create({
        orderNumber: `NS-STOCK-${Date.now()}`,
        customer: new mongoose.Types.ObjectId(),
        items: [{ product: product._id, variantId: red(), productName: product.name, sku: "NS-RED", quantity: 40, unitPrice: 650, lineTotal: 26000 }],
        shippingAddress: address,
        billingAddress: address,
        subtotal: 26000,
        totalAmount: 26000,
        inventoryReserved: true,
      });
      await m.reserveStock([{ productId: product._id, variantId: red(), quantity: 40 }], { order: order._id });
      let fresh = await m.Product.findById(product._id).lean();
      expect([fresh.stockQuantity, fresh.variants[0].stockQuantity]).toEqual([20, 20]);

      await expect(
        m.reserveStock([{ productId: product._id, variantId: red(), quantity: 21 }], {}),
      ).rejects.toMatchObject({ statusCode: 409, code: "out_of_stock" });

      // Concurrent releases (cancel racing expiry) return the stock exactly once.
      const released = await Promise.all([m.releaseOrderStock(order._id, {}), m.releaseOrderStock(order._id, {})]);
      expect(released.filter(Boolean)).toHaveLength(1);
      fresh = await m.Product.findById(product._id).lean();
      expect([fresh.stockQuantity, fresh.variants[0].stockQuantity]).toEqual([60, 60]);

      const ledger = await m.StockMovement.find({ order: order._id }).sort({ createdAt: 1 }).lean();
      expect(ledger.map((entry) => [entry.reason, entry.delta])).toEqual([["order_reserved", -40], ["order_released", 40]]);
    });
  });
});

describe("quotes", () => {
  it("snapshots list prices, then lets the buyer accept the store's offer", async () => {
    const buyer = { _id: new mongoose.Types.ObjectId() };
    const admin = { _id: new mongoose.Types.ObjectId() };
    await m.runWithTenant(wholesale, async () => {
      const submitted = await m.submitQuote(
        {
          contact: { name: "Asha", email: "asha@shop.test" },
          items: [{ productId: String(product._id), variantId: String(product.variants[0]._id), quantity: 100 }],
        },
        buyer,
      );
      expect(submitted.items[0]).toMatchObject({ listUnitPrice: 650, colorName: "Red" });

      const [{ id }] = await m.listCustomerQuotes(buyer);
      await expect(m.updateQuoteAsAdmin(id, admin, { status: "quoted" })).rejects.toThrow(/Price every line/);
      const detail = await m.getQuoteForAdmin(id);
      const quoted = await m.updateQuoteAsAdmin(id, admin, {
        status: "quoted",
        items: [{ id: detail.items[0].id, quotedUnitPrice: 600 }],
      });
      expect(quoted.totals.total).toBe(60000);
      expect((await m.respondToQuote(buyer, id, { decision: "accept" })).status).toBe("accepted");
    });
  });

  it("is not available to retail stores", async () => {
    await expect(
      m.runWithTenant(retail, () =>
        m.submitQuote({ contact: { name: "A", email: "a@b.test" }, items: [{ productId: String(product._id), quantity: 1 }] }, null),
      ),
    ).rejects.toThrow(/not available/);
  });
});
