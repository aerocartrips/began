import mongoose from "mongoose";
import { Order } from "@/lib/db/models/Order";
import { Product } from "@/lib/db/models/Product";
import { ProductActivity } from "@/lib/db/models/ProductActivity";
import { ProductAttribute } from "@/lib/db/models/ProductAttribute";
import { ProductType } from "@/lib/db/models/ProductType";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { listedProductFilter } from "@/lib/constants/product-status";
import { SCHEMA_PROPERTIES } from "@/lib/constants/catalog";
import { isSaleExpression } from "@/lib/services/revenue";
import { priceFieldFor, roundRupees } from "@/lib/catalog/pricing";
import { optionsOf, variantTitleOf } from "@/lib/catalog/variants";
import { getActiveTenant } from "@/lib/tenant/active";

/**
 * Catalogue insights (Admin → Catalogue insights): how each product type
 * sells and how its stock is placed, from paid orders, stock and first-party
 * shopper activity. The analyses a fashion buyer runs:
 *
 * - Sell-through: units sold / (sold + still in stock) over the period, and
 *   weeks of cover (stock ÷ the period's weekly sales rate).
 * - Size curve: each size's share of units sold against its share of stock.
 *   A size that sells more than it holds runs out first (reorder it); one
 *   that holds more than it sells ties up money. The sales shares are the
 *   ratio to buy the next run in.
 * - Restock priorities: unavailable or low variants, ranked by demand.
 * - Dead stock: listed products with stock and no sales in the period.
 *
 * Sales are order lines of paid, uncancelled orders (the same rule as revenue,
 * lib/services/revenue.js), valued before GST and shipping.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Size shares further apart than this (percentage points) are called out. */
const SIZE_GAP_POINTS = 5;
/** Units a type must have sold before its size curve is read (fewer is noise). */
const MIN_UNITS_FOR_CURVE = 10;
const LIST_LIMIT = 15;

const share = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * @param {{ days?: number, typeId?: string | null }} [options]
 */
export async function getCatalogInsights({ days = 30, typeId = null } = {}) {
  const span = Math.min(Math.max(Math.trunc(days) || 30, 7), 365);
  const since = new Date(Date.now() - span * DAY_MS);
  const tenant = await getActiveTenant();
  const priceField = priceFieldFor(tenant.salesMode);
  const typeFilter = typeId && mongoose.isValidObjectId(typeId) ? new mongoose.Types.ObjectId(typeId) : null;
  const scope = typeFilter ? { productType: typeFilter } : {};

  const [types, attributes, settings, inventory, sales, activity] = await Promise.all([
    ProductType.find({}).sort({ sortOrder: 1, name: 1 }).lean(),
    ProductAttribute.find({}).select("key name schemaProperty values.label").lean(),
    getStoreSettingsDocument(),
    Product.aggregate([
      { $match: scope },
      {
        $group: {
          _id: "$productType",
          products: { $sum: 1 },
          listed: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "active"] }, { $ne: ["$typeHidden", true] }] }, 1, 0] } },
          variants: { $sum: { $size: { $ifNull: ["$variants", []] } } },
          unitsOnHand: { $sum: "$stockQuantity" },
          stockValue: { $sum: { $multiply: ["$stockQuantity", { $ifNull: [`$${priceField}`, 0] }] } },
          outOfStockVariants: {
            $sum: { $size: { $filter: { input: { $ifNull: ["$variants", []] }, as: "variant", cond: { $lte: ["$$variant.stockQuantity", 0] } } } },
          },
        },
      },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $match: { $expr: isSaleExpression } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { product: "$items.product", variant: "$items.variantId" },
          units: { $sum: "$items.quantity" },
          value: { $sum: "$items.lineTotal" },
          options: { $first: "$items.options" },
        },
      },
    ]),
    ProductActivity.aggregate([
      { $match: { day: { $gte: since } } },
      { $group: { _id: "$product", views: { $sum: "$views" }, carts: { $sum: "$carts" }, wishlists: { $sum: "$wishlists" } } },
    ]),
  ]);

  const attributesByKey = new Map(attributes.map((attribute) => [attribute.key, attribute]));
  const typeById = new Map(types.map((type) => [String(type._id), type]));
  /** The option each type's size curve reads: its size chart's, else its first option meaning "size". */
  const sizeKeyOf = (type) =>
    type?.sizeChart?.optionKey ||
    type?.options?.find((option) => attributesByKey.get(option.key)?.schemaProperty === SCHEMA_PROPERTIES.SIZE)?.key ||
    "";

  // The products behind the sales and activity: their type, and their variants' options for sizes.
  const productIds = [...new Set([...sales.map((row) => String(row._id.product)), ...activity.map((row) => String(row._id))])];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select("name slug productType variants._id variants.options variants.title variants.colorName").lean()
    : [];
  const productById = new Map(products.map((product) => [String(product._id), product]));
  const typeOf = (productId) => {
    const type = productById.get(String(productId))?.productType;
    return type ? String(type) : "none";
  };
  const inScope = (key) => !typeFilter || key === String(typeFilter);

  /** @type {Map<string, { unitsSold: number, salesValue: number, views: number, carts: number }>} */
  const flow = new Map();
  const flowOf = (key) => {
    if (!flow.has(key)) flow.set(key, { unitsSold: 0, salesValue: 0, views: 0, carts: 0 });
    return flow.get(key);
  };
  /** Units sold per type, size value. */
  const soldBySize = new Map();
  /** Units sold per variant, or per product (`product:<id>`) when it has no variants: restock ranking. */
  const soldByVariant = new Map();
  const soldProducts = new Set();

  for (const row of sales) {
    const key = typeOf(row._id.product);
    if (!inScope(key)) continue;
    soldProducts.add(String(row._id.product));
    const entry = flowOf(key);
    entry.unitsSold += row.units;
    entry.salesValue += row.value;
    const unitKey = row._id.variant ? String(row._id.variant) : `product:${row._id.product}`;
    soldByVariant.set(unitKey, (soldByVariant.get(unitKey) ?? 0) + row.units);

    const sizeKey = sizeKeyOf(typeById.get(key));
    if (!sizeKey) continue;
    // The variant's size today; for a variant since deleted, the size the order recorded.
    const variant = productById.get(String(row._id.product))?.variants?.find((entry2) => String(entry2._id) === String(row._id.variant));
    const sizeName = attributesByKey.get(sizeKey)?.name;
    const size = optionsOf(variant)[sizeKey] ?? row.options?.find((option) => option.name === sizeName)?.value;
    if (!size) continue;
    const sizes = soldBySize.get(key) ?? new Map();
    sizes.set(size, (sizes.get(size) ?? 0) + row.units);
    soldBySize.set(key, sizes);
  }
  for (const row of activity) {
    const key = typeOf(row._id);
    if (!inScope(key)) continue;
    const entry = flowOf(key);
    entry.views += row.views;
    entry.carts += row.carts;
  }

  // Stock per size, per type with a size option (one pass over variants).
  const sizeKeys = [...new Set(types.map(sizeKeyOf).filter(Boolean))];
  const stockRows = sizeKeys.length
    ? await Product.aggregate([
        { $match: { ...scope, productType: typeFilter ?? { $ne: null } } },
        { $unwind: "$variants" },
        { $project: { productType: 1, stock: "$variants.stockQuantity", pairs: { $objectToArray: { $ifNull: ["$variants.options", {}] } } } },
        { $unwind: "$pairs" },
        { $match: { "pairs.k": { $in: sizeKeys } } },
        {
          $group: {
            _id: { type: "$productType", key: "$pairs.k", size: "$pairs.v" },
            stock: { $sum: "$stock" },
            variants: { $sum: 1 },
            stockouts: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
          },
        },
      ])
    : [];

  const weeks = span / 7;
  const byType = [...inventory.map((row) => (row._id ? String(row._id) : "none")), ...flow.keys()]
    .filter((key, index, all) => all.indexOf(key) === index && inScope(key))
    .map((key) => {
      const stock = inventory.find((row) => (row._id ? String(row._id) : "none") === key) ?? {};
      const moves = flow.get(key) ?? { unitsSold: 0, salesValue: 0, views: 0, carts: 0 };
      const type = typeById.get(key);
      const unitsOnHand = stock.unitsOnHand ?? 0;
      const weeklyRate = moves.unitsSold / weeks;
      return {
        id: key,
        name: type?.pluralName ?? "Without a type",
        isActive: type ? type.isActive : true,
        products: stock.products ?? 0,
        listed: stock.listed ?? 0,
        variants: stock.variants ?? 0,
        outOfStockVariants: stock.outOfStockVariants ?? 0,
        unitsOnHand,
        stockValue: roundRupees(stock.stockValue ?? 0),
        unitsSold: moves.unitsSold,
        salesValue: roundRupees(moves.salesValue),
        sellThrough: share(moves.unitsSold, moves.unitsSold + unitsOnHand),
        weeksOfCover: weeklyRate > 0 ? Math.round((unitsOnHand / weeklyRate) * 10) / 10 : null,
        views: moves.views,
        carts: moves.carts,
        cartRate: share(moves.carts, moves.views),
      };
    })
    .sort((left, right) => right.salesValue - left.salesValue || right.unitsOnHand - left.unitsOnHand);

  const sizeCurves = types
    .filter((type) => inScope(String(type._id)) && sizeKeyOf(type))
    .map((type) => {
      const key = String(type._id);
      const sizeKey = sizeKeyOf(type);
      const sold = soldBySize.get(key) ?? new Map();
      const stock = new Map(stockRows.filter((row) => String(row._id.type) === key && row._id.key === sizeKey).map((row) => [row._id.size, row]));
      const own = type.options.find((option) => option.key === sizeKey)?.values ?? [];
      const order = own.length ? own : (attributesByKey.get(sizeKey)?.values ?? []).map((value) => value.label);
      const sizes = [...new Set([...order.filter((size) => sold.has(size) || stock.has(size)), ...sold.keys(), ...stock.keys()])];
      const totalSold = [...sold.values()].reduce((total, units) => total + units, 0);
      const totalStock = [...stock.values()].reduce((total, row) => total + row.stock, 0);
      const readable = totalSold >= MIN_UNITS_FOR_CURVE;
      return {
        typeId: key,
        typeName: type.pluralName,
        optionName: attributesByKey.get(sizeKey)?.name ?? sizeKey,
        totalSold,
        totalStock,
        readable,
        sizes: sizes.map((size) => {
          const units = sold.get(size) ?? 0;
          const onHand = stock.get(size)?.stock ?? 0;
          const soldShare = share(units, totalSold);
          const stockShare = share(onHand, totalStock);
          const gap = Math.round((soldShare - stockShare) * 10) / 10;
          return {
            size,
            unitsSold: units,
            soldShare,
            stock: onHand,
            stockShare,
            gap,
            stockouts: stock.get(size)?.stockouts ?? 0,
            variants: stock.get(size)?.variants ?? 0,
            call: !readable ? "none" : gap >= SIZE_GAP_POINTS ? "reorder" : gap <= -SIZE_GAP_POINTS ? "overstocked" : "balanced",
          };
        }),
      };
    })
    .filter((curve) => curve.sizes.length > 0);

  const [restock, deadStock] = await Promise.all([
    restockPriorities({ scope, threshold: settings.commerce.lowStockThreshold, soldByVariant, activity, typeById }),
    deadStockOf({ scope, since, soldProducts, priceField }),
  ]);

  const total = (field) => byType.reduce((sum, row) => sum + (row[field] ?? 0), 0);
  const unitsSold = total("unitsSold");
  const unitsOnHand = total("unitsOnHand");
  return {
    days: span,
    since: since.toISOString(),
    salesMode: tenant.salesMode,
    lowStockThreshold: settings.commerce.lowStockThreshold,
    types: types.map((type) => ({ id: String(type._id), name: type.pluralName, isActive: type.isActive })),
    summary: {
      unitsSold,
      salesValue: roundRupees(total("salesValue")),
      unitsOnHand,
      stockValue: roundRupees(total("stockValue")),
      sellThrough: share(unitsSold, unitsSold + unitsOnHand),
      outOfStockVariants: total("outOfStockVariants"),
    },
    byType,
    sizeCurves,
    restock,
    deadStock,
  };
}

/**
 * What shoppers can't buy (stock below the minimum order) or is about to run
 * out (at or below the low-stock alert), variant by variant, most wanted
 * first: units sold in the period weigh more than product views.
 */
async function restockPriorities({ scope, threshold, soldByVariant, activity, typeById }) {
  const views = new Map(activity.map((row) => [String(row._id), row.views]));
  const low = (stock) => ({ $or: [{ $lte: [stock, threshold] }, { $lt: [stock, "$minimumOrderQuantity"] }] });
  const products = await Product.find({
    ...listedProductFilter(),
    ...scope,
    $expr: {
      $or: [
        { $and: [{ $eq: [{ $size: { $ifNull: ["$variants", []] } }, 0] }, low("$stockQuantity")] },
        { $anyElementTrue: [{ $map: { input: { $ifNull: ["$variants", []] }, as: "variant", in: low("$$variant.stockQuantity") } }] },
      ],
    },
  })
    .sort({ popularityScore: -1, _id: -1 })
    .limit(500)
    .select("name slug sku productType stockQuantity minimumOrderQuantity variants._id variants.options variants.title variants.colorName variants.sku variants.stockQuantity")
    .lean();

  const rows = [];
  for (const product of products) {
    const minimum = product.minimumOrderQuantity ?? 1;
    const productViews = views.get(String(product._id)) ?? 0;
    const base = { productId: String(product._id), productName: product.name, slug: product.slug, typeName: typeById.get(String(product.productType))?.pluralName ?? "" };
    const units = product.variants?.length
      ? product.variants.map((variant) => ({ id: String(variant._id), title: variant.title || variantTitleOf(variant.options, variant.colorName), sku: variant.sku, stock: variant.stockQuantity }))
      : [{ id: "", title: "", sku: product.sku, stock: product.stockQuantity }];
    for (const unit of units) {
      if (unit.stock > threshold && unit.stock >= minimum) continue;
      const sold = soldByVariant.get(unit.id || `product:${base.productId}`) ?? 0;
      rows.push({
        ...base,
        variantId: unit.id,
        variantTitle: unit.title,
        sku: unit.sku,
        stock: unit.stock,
        unavailable: unit.stock < minimum,
        unitsSold: sold,
        views: productViews,
        demand: sold * 10 + productViews,
      });
    }
  }
  return rows
    .filter((row) => row.demand > 0 || row.unavailable)
    .sort((left, right) => right.demand - left.demand || left.stock - right.stock)
    .slice(0, LIST_LIMIT);
}

/** Listed products older than the period, with stock and not one sale in it; most money tied up first. */
async function deadStockOf({ scope, since, soldProducts, priceField }) {
  const sold = [...soldProducts].filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  const rows = await Product.aggregate([
    { $match: { ...listedProductFilter(), ...scope, stockQuantity: { $gt: 0 }, createdAt: { $lt: since }, _id: { $nin: sold } } },
    { $project: { name: 1, slug: 1, stockQuantity: 1, createdAt: 1, stockValue: { $multiply: ["$stockQuantity", { $ifNull: [`$${priceField}`, 0] }] } } },
    { $sort: { stockValue: -1, _id: 1 } },
    { $limit: LIST_LIMIT },
  ]);
  return rows.map((row) => ({
    productId: String(row._id),
    productName: row.name,
    slug: row.slug,
    stock: row.stockQuantity,
    stockValue: roundRupees(row.stockValue),
    listedSince: new Date(row.createdAt).toISOString(),
  }));
}
