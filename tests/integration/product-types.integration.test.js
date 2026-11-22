/**
 * Selling several kinds of product: templates and the shared attribute
 * library, T-shirts with a variant per colour and size, type-scoped filters,
 * turning a type off and on, renaming values, variant stock alerts, the
 * upgrade of a saree-only catalogue and the size-curve insights, against an
 * in-memory MongoDB replica set (product edits run in transactions).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

vi.mock("@/lib/services/email.service", () => ({ sendTransactionalEmail: vi.fn(async () => ({ sent: false })) }));

let replSet;
let m;
let store;
let saree;
let tee;
let category;
const admin = { _id: new mongoose.Types.ObjectId() };
const shopper = { _id: new mongoose.Types.ObjectId() };

const inStore = (work) => m.runWithTenant(store, work);
const variant = (color, size, stockQuantity, sku) => ({ options: { color, size }, sku: sku ?? `TEE-${color}-${size}`.toUpperCase(), stockQuantity });
const teeProduct = (overrides = {}) => ({
  name: "Classic Tee",
  sku: "TEE",
  productType: tee.id,
  category: String(category._id),
  price: 600,
  wholesalePrice: 400,
  status: "active",
  attributes: { fabric: "cotton", fit: "Regular", gender: "Women" },
  variants: [variant("Red", "M", 5), variant("Red", "L", 0), variant("Blue", "M", 4)],
  ...overrides,
});

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri("norosilk_types_test");
  await (await import("@/lib/db/connect")).connectDB();
  m = {
    Tenant: (await import("@/lib/db/models/Tenant")).Tenant,
    Product: (await import("@/lib/db/models/Product")).Product,
    ProductType: (await import("@/lib/db/models/ProductType")).ProductType,
    ProductAttribute: (await import("@/lib/db/models/ProductAttribute")).ProductAttribute,
    Category: (await import("@/lib/db/models/Category")).Category,
    Order: (await import("@/lib/db/models/Order")).Order,
    StockMovement: (await import("@/lib/db/models/StockMovement")).StockMovement,
    StockAlert: (await import("@/lib/db/models/StockAlert")).StockAlert,
    ...(await import("@/lib/tenant/context")),
    ...(await import("@/lib/tenant/resolve")),
    ...(await import("@/lib/services/product-type.service")),
    ...(await import("@/lib/services/attribute.service")),
    ...(await import("@/lib/services/product.service")),
    ...(await import("@/lib/services/cart-pricing.service")),
    ...(await import("@/lib/services/inventory.service")),
    ...(await import("@/lib/services/stock-alert.service")),
    ...(await import("@/lib/services/catalog-upgrade.service")),
    ...(await import("@/lib/services/catalog-insights.service")),
    ...(await import("@/lib/catalog/catalog-config")),
    ...(await import("@/lib/catalog/query")),
  };
  await Promise.all([m.Product, m.ProductType, m.ProductAttribute, m.Category, m.StockAlert].map((model) => model.syncIndexes()));
  store = m.toPublicTenant((await m.Tenant.create({ slug: "fashion", name: "Fashion Co", domains: ["fashion.test"], salesMode: "retail" })).toObject());
  await inStore(async () => {
    category = await m.Category.create({ name: "New in", slug: "new-in" });
    saree = await m.createProductTypeFromTemplate({ template: "saree" });
    tee = await m.createProductTypeFromTemplate({ template: "t-shirt" });
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

describe("product types", () => {
  it("install into one shared attribute library, merging values", async () => {
    await inStore(async () => {
      const keys = (await m.ProductAttribute.find({}).select("key").lean()).map((row) => row.key);
      // Colour and Fabric are shared by sarees and T-shirts: one attribute each.
      expect(keys.filter((key) => key === "color")).toHaveLength(1);
      expect(keys).toEqual(expect.arrayContaining(["fabric", "weave", "size", "fit", "neck", "sleeve", "gender"]));
      const fabric = await m.ProductAttribute.findOne({ key: "fabric" }).lean();
      expect(fabric.values.map((value) => value.label)).toEqual(expect.arrayContaining(["Pure Silk", "Organic cotton"]));
      expect(tee).toMatchObject({ name: "T-shirt", pluralName: "T-shirts", slug: "t-shirts", template: "t-shirt" });
      expect(tee.sizeChart.optionKey).toBe("size");
      const another = await m.createProductTypeFromTemplate({ template: "t-shirt", isActive: false });
      expect(another).toMatchObject({ name: "T-shirt 2", slug: "t-shirts-2" });
      await m.deleteProductType(String(another._id));
    });
  });
});

describe("a T-shirt with a variant per colour and size", () => {
  let product;

  it("stores canonical details, titled variants, library swatches and the size range", async () => {
    product = await inStore(() => m.createProduct(teeProduct(), admin));
    expect(product.attributes.map((entry) => [entry.key, entry.value])).toEqual([["fabric", "Cotton"], ["fit", "Regular"], ["gender", "Women"]]);
    expect(product.variants.map((entry) => [entry.title, entry.colorName, entry.colorHex])).toEqual([
      ["Red / M", "Red", "#c62a2a"],
      ["Red / L", "Red", "#c62a2a"],
      ["Blue / M", "Blue", "#2f6fd0"],
    ]);
    expect(product).toMatchObject({ stockQuantity: 9, colors: ["Red", "Blue"], sizeRange: "M, L", typeHidden: false });
    const ledger = await inStore(() => m.StockMovement.find({ product: product._id }).lean());
    expect(ledger.map((entry) => entry.delta).sort()).toEqual([0, 4, 5].filter(Boolean).sort());
  });

  it("refuses combinations the type doesn't offer, repeats, missing options and taken SKUs", async () => {
    const attempt = (overrides) => inStore(() => m.createProduct(teeProduct({ sku: `TEE-${Math.random().toString(36).slice(2, 7)}`, ...overrides }), admin));
    await expect(attempt({ variants: [variant("Red", "XXS", 1, "X1")] })).rejects.toMatchObject({ statusCode: 422, message: expect.stringMatching(/aren't offered in XXS/) });
    await expect(attempt({ variants: [variant("Red", "M", 1, "X2"), variant("Red", "M", 1, "X3")] })).rejects.toMatchObject({ message: "Red / M is listed twice." });
    await expect(attempt({ variants: [{ options: { color: "Red" }, sku: "X4", stockQuantity: 1 }] })).rejects.toMatchObject({ message: "Choose a size for every variant." });
    await expect(attempt({ variants: [variant("Chartreuse", "M", 1, "X5")] })).rejects.toMatchObject({ message: expect.stringMatching(/isn't one of the Colour values/) });
    // Required to list: gender. A draft may be saved without it.
    await expect(attempt({ attributes: { fabric: "Cotton" }, variants: [variant("Red", "S", 1, "X6")] })).rejects.toMatchObject({ message: expect.stringMatching(/Add gender/) });
    await expect(attempt({ status: "draft", attributes: { fabric: "Cotton" }, variants: [variant("Red", "S", 1, "X7")] })).resolves.toBeTruthy();
    await expect(attempt({ variants: [variant("Red", "S", 1, "TEE-RED-M")] })).rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/already used by “Classic Tee”/) });
  });

  it("keeps variant ids and stock through an edit and refuses stock changed meanwhile", async () => {
    const [redM, redL, blueM] = product.variants.map((entry) => String(entry._id));
    const edit = (variants) =>
      inStore(() =>
        m.updateProduct(String(product._id), {
          variants: variants.map((entry) => ({ ...entry, stockBaseline: entry.stockBaseline ?? entry.stockQuantity })),
        }, admin),
      );
    const updated = await edit([
      { _id: redM, options: { color: "Red", size: "M" }, sku: "TEE-RED-M", stockQuantity: 5 },
      { _id: redL, options: { color: "Red", size: "L" }, sku: "TEE-RED-L", stockQuantity: 0 },
      { _id: blueM, options: { color: "Blue", size: "M" }, sku: "TEE-BLUE-M", stockQuantity: 4 },
      { options: { color: "Blue", size: "XL" }, sku: "TEE-BLUE-XL", stockQuantity: 6 },
    ]);
    expect(updated.variants.slice(0, 3).map((entry) => String(entry._id))).toEqual([redM, redL, blueM]);
    expect(updated).toMatchObject({ stockQuantity: 15, sizeRange: "M, L, XL" });

    // An order takes 2 of Red / M while the editor still shows 5.
    await inStore(() => m.reserveStock([{ productId: product._id, variantId: redM, quantity: 2 }], {}));
    await expect(
      edit([
        { _id: redM, options: { color: "Red", size: "M" }, sku: "TEE-RED-M", stockQuantity: 10, stockBaseline: 5 },
        { _id: redL, options: { color: "Red", size: "L" }, sku: "TEE-RED-L", stockQuantity: 0 },
        { _id: blueM, options: { color: "Blue", size: "M" }, sku: "TEE-BLUE-M", stockQuantity: 4 },
      ]),
    ).rejects.toMatchObject({ statusCode: 409 });
    product = await inStore(() => m.Product.findById(product._id));
  });

  it("filters a type's listing on one variant: Red and L means a red L, in stock when asked", async () => {
    await inStore(async () => {
      await m.createProduct(teeProduct({ name: "Boxy Tee", sku: "BOXY", attributes: { fabric: "Linen", fit: "Oversized", gender: "Men" }, variants: [variant("Red", "M", 2, "BOXY-RM"), variant("Blue", "L", 3, "BOXY-BL")] }), admin);
    });
    const config = await m.getCatalogConfig(store.id);
    const search = (params) => m.searchCatalog(store.id, "retail", m.parseCatalogQuery(params, { type: "t-shirts" }, config));

    const all = await search({});
    expect(all.total).toBe(2);
    expect(all.facets.map((group) => group.key)).toEqual(["color", "size", "fabric", "fit", "gender"]);
    // Sizes in the type's order, not by count.
    expect(all.facets.find((group) => group.key === "size").values.map((entry) => entry.value)).toEqual(["M", "L", "XL"]);

    // Boxy has red (M) and an L (blue), but no red L: only Classic matches.
    const redL = await search({ color: "Red", size: "L" });
    expect(redL.items.map((item) => item.name)).toEqual(["Classic Tee"]);
    // Classic's red L is sold out.
    expect((await search({ color: "Red", size: "L", stock: "1" })).total).toBe(0);
    // A size's own count ignores the size selection but respects the colour one.
    const sizes = (await search({ color: "Blue", size: "M" })).facets.find((group) => group.key === "size").values;
    expect(sizes.map((entry) => [entry.value, entry.count])).toEqual([["M", 1], ["L", 1], ["XL", 1]]);

    const linen = await search({ fabric: "linen" });
    expect(linen.items.map((item) => item.name)).toEqual(["Boxy Tee"]);
    // Sarees aren't T-shirts.
    expect((await m.searchCatalog(store.id, "retail", m.parseCatalogQuery({}, { type: "sarees" }, config))).total).toBe(0);
  });

  it("builds the product page with options in the type's order, sizes on the size guide", async () => {
    const detail = await m.getProductDetail(store.id, "retail", "classic-tee");
    expect(detail.type).toMatchObject({ name: "T-shirt", slug: "t-shirts" });
    // Values in the library's order (the admin reorders them there), sizes in the type's.
    expect(detail.options.map((option) => [option.key, option.kind, option.values.map((entry) => entry.value)])).toEqual([
      ["color", "color", ["Blue", "Red"]],
      ["size", "size", ["M", "L", "XL"]],
    ]);
    expect(detail.specs.map((spec) => [spec.label, spec.value])).toEqual([["Fabric", "Cotton"], ["Fit", "Regular"], ["Gender", "Women"]]);
    expect(detail.schemaFacts).toMatchObject({ material: "Cotton", suggestedGender: "Women" });
    expect(detail.sizeChart?.optionKey).toBe("size");
    expect(detail.variants.find((entry) => entry.title === "Red / M")).toMatchObject({ stock: 3, options: { color: "Red", size: "M" } });
  });

  it("lets shoppers wait for a sold-out size while other sizes are in stock", async () => {
    const redL = String(product.variants.find((entry) => entry.title === "Red / L")._id);
    const redM = String(product.variants.find((entry) => entry.title === "Red / M")._id);
    await inStore(async () => {
      expect(await m.subscribeStockAlert(shopper, String(product._id), redL)).toEqual({ subscribed: true });
      expect(await m.getStockAlert(shopper, String(product._id), redL)).toEqual({ subscribed: true });
      await expect(m.subscribeStockAlert(shopper, String(product._id), redM)).rejects.toMatchObject({ statusCode: 409 });
      // The product as a whole can be ordered, so a whole-product alert is refused.
      await expect(m.subscribeStockAlert(shopper, String(product._id))).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});

describe("what the store sells", () => {
  it("hides a type that isn't on sale everywhere shoppers look, and brings it back unchanged", async () => {
    const classic = await inStore(() => m.Product.findOne({ slug: "classic-tee" }).lean());
    const redM = String(classic.variants[0]._id);
    await inStore(() => m.setSellingTypes([String(saree._id)]));

    const hidden = await inStore(() => m.Product.findById(classic._id).lean());
    expect(hidden).toMatchObject({ status: "active", typeHidden: true });
    const config = await m.getCatalogConfig(store.id);
    expect(config.types.map((type) => type.slug)).toEqual(["sarees"]);
    expect((await m.searchCatalog(store.id, "retail", m.parseCatalogQuery({}, {}, config))).total).toBe(0);
    expect(await m.getProductDetail(store.id, "retail", "classic-tee")).toBeNull();
    const priced = await inStore(() => m.priceCartItems([{ productId: String(classic._id), variantId: redM, quantity: 1 }]));
    expect(priced.lines[0].unavailable).toBe(true);
    await expect(inStore(() => m.reserveStock([{ productId: classic._id, variantId: redM, quantity: 1 }], {}))).rejects.toMatchObject({ statusCode: 409 });

    await inStore(() => m.setSellingTypes([String(saree._id), tee.id]));
    expect(await inStore(() => m.Product.findById(classic._id).lean())).toMatchObject({ status: "active", typeHidden: false });
    expect(await m.getProductDetail(store.id, "retail", "classic-tee")).not.toBeNull();
  });

  it("adds new kinds from templates when they are picked in Store settings", async () => {
    const result = await inStore(() => m.setSellingTypes([String(saree._id), tee.id], ["jeans"]));
    expect(result.types.find((type) => type.template === "jeans")).toMatchObject({ isActive: true, pluralName: "Jeans" });
    // A retried save (or a second tab) reuses the type instead of adding "Jeans 2".
    const again = await inStore(() => m.setSellingTypes([String(saree._id), tee.id], ["jeans"]));
    expect(again.types.filter((type) => type.template === "jeans")).toHaveLength(1);
    await inStore(async () => {
      const jeans = await m.ProductType.findOne({ template: "jeans" });
      await m.deleteProductType(String(jeans._id));
    });
  });

  it("refuses type edits that would strand products' variants", async () => {
    await inStore(async () => {
      await expect(m.updateProductType(tee.id, { options: [{ key: "color", values: [] }] })).rejects.toMatchObject({ statusCode: 409 });
      await expect(m.updateProductType(tee.id, { options: [{ key: "color", values: [] }, { key: "size", values: ["S", "M"] }] })).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/still used/),
      });
      await expect(m.deleteProductType(tee.id)).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});

describe("renaming a value", () => {
  it("renames it on every product, variant, photo group and type that uses it", async () => {
    await inStore(async () => {
      const classic = await m.Product.findOne({ slug: "classic-tee" });
      classic.colorMedia = [{ color: "Red", images: [{ url: "https://res.cloudinary.com/demo/image/upload/v1/red.jpg" }] }];
      await classic.save();

      const colour = await m.ProductAttribute.findOne({ key: "color" }).lean();
      const values = colour.values.map((value) => ({ _id: String(value._id), label: value.label === "Red" ? "Crimson" : value.label, hex: value.hex }));
      await m.updateAttribute(String(colour._id), { values });

      const renamed = await m.Product.findOne({ slug: "classic-tee" }).lean();
      expect(renamed.variants.map((entry) => entry.title)).toEqual(expect.arrayContaining(["Crimson / M", "Crimson / L"]));
      expect(renamed.colors).toEqual(["Crimson", "Blue"]);
      expect(renamed.colorMedia.map((media) => media.color)).toEqual(["Crimson"]);

      // A value products still use can't be deleted.
      const current = await m.ProductAttribute.findOne({ key: "color" }).lean();
      await expect(
        m.updateAttribute(String(current._id), { values: current.values.filter((value) => value.label !== "Crimson").map((value) => ({ _id: String(value._id), label: value.label })) }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});

describe("the catalogue upgrade", () => {
  let legacy;
  const variantIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

  beforeAll(async () => {
    legacy = m.toPublicTenant((await m.Tenant.create({ slug: "legacy", name: "Legacy Sarees", domains: ["legacy.test"], salesMode: "wholesale" })).toObject());
    const tenantId = new mongoose.Types.ObjectId(legacy.id);
    const legacyCategory = await m.runWithTenant(legacy, () => m.Category.create({ name: "Sarees", slug: "sarees" }));
    const db = mongoose.connection.db;
    // The old per-value attribute lists, and products saved with the original fields.
    await db.collection("attributes").insertMany([
      { tenantId, type: "fabric", label: "Pure Silk", slug: "pure-silk", hex: "", sortOrder: 0, isActive: true },
      { tenantId, type: "color", label: "Maroon", slug: "maroon", hex: "#7a1f2b", sortOrder: 0, isActive: true },
    ]);
    const base = { tenantId, category: legacyCategory._id, price: 2000, wholesalePrice: 1500, minimumOrderQuantity: 5, status: "active", createdAt: new Date(), updatedAt: new Date() };
    await db.collection("products").insertMany([
      {
        ...base,
        name: "Old Banarasi",
        nameLower: "old banarasi",
        slug: "old-banarasi",
        sku: "OLD-1",
        fabric: "pure silk",
        weavingType: "Banarasi",
        occasion: "Wedding",
        design: "Zari border",
        sareeLength: "6.3 m",
        blousePiece: "Included",
        colors: ["Maroon", "Gold"],
        stockQuantity: 12,
        variants: [
          { _id: variantIds[0], colorName: "Maroon", colorHex: "#7a1f2b", sku: "OLD-1-M", stockQuantity: 7, images: [{ url: "https://res.cloudinary.com/demo/image/upload/v1/maroon.jpg", isPrimary: true, sortOrder: 0 }], sortOrder: 0 },
          { _id: variantIds[1], colorName: "gold", colorHex: "#c9a227", sku: "OLD-1-G", stockQuantity: 5, images: [], sortOrder: 1 },
        ],
      },
      { ...base, name: "Old Plain", nameLower: "old plain", slug: "old-plain", sku: "OLD-2", fabric: "Cotton", colors: ["Teal"], stockQuantity: 3, variants: [] },
    ]);
  });

  it("plans the upgrade without writing anything", async () => {
    const plan = await m.runWithTenant(legacy, () => m.upgradeLegacyCatalog({ apply: false }));
    expect(plan).toMatchObject({ applied: false, products: 2, converted: 0, variants: 2, colourPhotoGroups: 1, oldListValues: 2, type: { name: "Saree", status: "created" } });
    expect(await m.runWithTenant(legacy, () => m.ProductType.countDocuments({}))).toBe(0);
  });

  it("converts every product to the Saree type, keeping variant ids and existing filter links", async () => {
    const result = await m.runWithTenant(legacy, () => m.upgradeLegacyCatalog({ apply: true }));
    expect(result).toMatchObject({ applied: true, converted: 2 });
    const raw = await mongoose.connection.db.collection("products").findOne({ slug: "old-banarasi" });
    expect(raw.fabric).toBeUndefined();
    expect(raw.weavingType).toBeUndefined();
    expect(raw.attributes).toEqual([
      { key: "fabric", value: "Pure Silk" },
      { key: "weave", value: "Banarasi" },
      { key: "occasion", value: "Wedding" },
      { key: "pattern", value: "Zari border" },
      { key: "saree_length", value: "6.3 m" },
      { key: "blouse_piece", value: "Included" },
    ]);
    expect(raw.variants.map((entry) => [String(entry._id), entry.options, entry.title, entry.images])).toEqual([
      [String(variantIds[0]), { color: "Maroon" }, "Maroon", undefined],
      [String(variantIds[1]), { color: "gold" }, "gold", undefined],
    ]);
    expect(raw.colorMedia).toEqual([{ color: "Maroon", images: [expect.objectContaining({ url: "https://res.cloudinary.com/demo/image/upload/v1/maroon.jpg" })] }]);
    expect(raw.stockQuantity).toBe(12);

    const config = await m.getCatalogConfig(legacy.id);
    expect(config.types.map((type) => type.slug)).toEqual(["sarees"]);
    expect(m.sellsSareesOnly(config)).toBe(true);
    // The old `?fabric=` links still filter.
    const silk = await m.searchCatalog(legacy.id, "wholesale", m.parseCatalogQuery({ fabric: "Pure Silk" }, {}, config));
    expect(silk.items.map((item) => item.name)).toEqual(["Old Banarasi"]);
    const detail = await m.getProductDetail(legacy.id, "wholesale", "old-banarasi");
    expect(detail.specs.map((spec) => spec.label)).toEqual(["Fabric", "Weave", "Occasion", "Pattern", "Saree length", "Blouse piece"]);
    expect(detail.variants[0].images.map((image) => image.url)).toEqual(["https://res.cloudinary.com/demo/image/upload/v1/maroon.jpg"]);

    // Re-running finds nothing left to convert.
    expect((await m.runWithTenant(legacy, () => m.upgradeLegacyCatalog({ apply: true }))).products).toBe(0);
  });
});

describe("catalogue insights", () => {
  it("measures sell-through by type and reads the size curve from sales", async () => {
    await inStore(async () => {
      const classic = await m.Product.findOne({ slug: "classic-tee" }).lean();
      const byTitle = new Map(classic.variants.map((entry) => [entry.title, entry]));
      const address = { fullName: "A Buyer", phone: "9876543210", addressLine1: "1 Road", city: "Pune", state: "Maharashtra", pincode: "411001", country: "India" };
      const line = (title, quantity) => ({
        product: classic._id,
        variantId: byTitle.get(title)._id,
        productName: classic.name,
        sku: byTitle.get(title).sku,
        quantity,
        unitPrice: 600,
        lineTotal: 600 * quantity,
      });
      await m.Order.create({
        orderNumber: `FAS-${Date.now()}`,
        customer: shopper._id,
        items: [line("Crimson / M", 9), line("Blue / M", 2), line("Blue / XL", 1)],
        shippingAddress: address,
        billingAddress: address,
        subtotal: 7200,
        totalAmount: 7200,
        paymentStatus: "paid",
        orderStatus: "confirmed",
      });
      // Cancelled orders aren't sales.
      await m.Order.create({
        orderNumber: `FAS-X-${Date.now()}`,
        customer: shopper._id,
        items: [line("Blue / XL", 50)],
        shippingAddress: address,
        billingAddress: address,
        subtotal: 30000,
        totalAmount: 30000,
        paymentStatus: "paid",
        orderStatus: "cancelled",
      });

      const insights = await m.getCatalogInsights({ days: 30 });
      const tees = insights.byType.find((row) => row.name === "T-shirts");
      expect(tees).toMatchObject({ unitsSold: 12, salesValue: 7200 });
      expect(tees.sellThrough).toBeGreaterThan(0);

      const curve = insights.sizeCurves.find((entry) => entry.typeName === "T-shirts");
      expect(curve.readable).toBe(true);
      const m_ = curve.sizes.find((size) => size.size === "M");
      // M sold 11 of 12 units but holds only part of the stock: reorder it.
      expect(m_).toMatchObject({ unitsSold: 11, soldShare: 91.7, call: "reorder" });
      // In the type's size order; S is stock only (the draft tee): stock counts wherever it is held.
      expect(curve.sizes.map((size) => size.size)).toEqual(["S", "M", "L", "XL"]);
      expect(curve.sizes[0]).toMatchObject({ size: "S", unitsSold: 0, stock: 1 });
      // The sold-out Crimson / L tops the restock list.
      expect(insights.restock.map((row) => row.variantTitle)).toContain("Crimson / L");
    });
  });

  it("ranks products without variants by their own sales", async () => {
    await inStore(async () => {
      const stoles = await m.createProductType({ name: "Stole", fields: [], options: [] });
      const stole = await m.createProduct(
        { name: "Wool Stole", sku: "STOLE-1", productType: String(stoles._id), category: String(category._id), price: 900, wholesalePrice: 700, status: "active", stockQuantity: 2 },
        admin,
      );
      const address = { fullName: "A Buyer", phone: "9876543210", addressLine1: "1 Road", city: "Pune", state: "Maharashtra", pincode: "411001", country: "India" };
      await m.Order.create({
        orderNumber: `FAS-S-${Date.now()}`,
        customer: shopper._id,
        items: [{ product: stole._id, productName: stole.name, sku: stole.sku, quantity: 4, unitPrice: 900, lineTotal: 3600 }],
        shippingAddress: address,
        billingAddress: address,
        subtotal: 3600,
        totalAmount: 3600,
        paymentStatus: "paid",
        orderStatus: "confirmed",
      });

      const insights = await m.getCatalogInsights({ days: 30 });
      // 2 left (at or below the low-stock alert of 5) after selling 4: it is on the list with its sales.
      expect(insights.restock.find((row) => row.productName === "Wool Stole")).toMatchObject({ variantId: "", stock: 2, unitsSold: 4 });
    });
  });
});
