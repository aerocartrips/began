import mongoose from "mongoose";
import { Product } from "@/lib/db/models/Product";
import { ProductType } from "@/lib/db/models/ProductType";
import { ProductAttribute } from "@/lib/db/models/ProductAttribute";
import { requireTenantId } from "@/lib/tenant/context";
import { ATTRIBUTE_INPUTS, LISTED_INPUTS } from "@/lib/constants/catalog";
import { ATTRIBUTE_PRESETS } from "@/lib/catalog/type-templates";
import { canonicalizeValue } from "@/lib/catalog/attribute-values";
import { searchTextOf } from "@/lib/catalog/variants";
import { slugify } from "@/lib/utils/slugify";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";
import { StockAlert } from "@/lib/db/models/StockAlert";

/**
 * One-time upgrade of a store's catalogue from the original saree-only
 * fields (fabric, weavingType, occasion, design, sareeLength, blousePiece and
 * colour-only variants) to product types and the attribute library:
 *
 * 1. The store's old attribute lists and the values its products use become
 *    library attributes with the same keys, so existing filter links
 *    (`/products?fabric=Silk`) keep working. Letter-case variants merge into
 *    one value ("Pure silk" → "Pure Silk").
 * 2. A "Saree" product type is created with those details and a Colour option.
 * 3. Every product without a type becomes a Saree: its details move into
 *    `attributes`, each variant gets its colour as an option (variant ids are
 *    kept, so carts, orders and the stock ledger still point at them), and
 *    colour photos move into colour photo groups.
 *
 * Variants are changed field by field, never replaced, so stock that moves
 * while the upgrade runs is never overwritten. Safe to re-run: only products
 * still without a type are touched and library values are merged.
 */

/** Old product field → library attribute key (the old attribute list types where they had one). */
const LEGACY_FIELDS = {
  fabric: "fabric",
  weavingType: "weave",
  occasion: "occasion",
  design: "pattern",
  sareeLength: "saree_length",
  blousePiece: "blouse_piece",
};

/** How each upgraded attribute is set up when the library doesn't have it yet. */
const UPGRADE_DEFINITIONS = {
  fabric: { input: ATTRIBUTE_INPUTS.SELECT, filterable: true },
  weave: { input: ATTRIBUTE_INPUTS.SELECT, filterable: true },
  occasion: { input: ATTRIBUTE_INPUTS.SELECT, filterable: true },
  // Pattern was never a storefront filter; it stays off until the store turns it on.
  pattern: { input: ATTRIBUTE_INPUTS.SELECT, filterable: false },
  color: { input: ATTRIBUTE_INPUTS.COLOR, filterable: true },
  // Free text before; kept as text so no value is lost.
  saree_length: { input: ATTRIBUTE_INPUTS.TEXT, filterable: false },
  blouse_piece: { input: ATTRIBUTE_INPUTS.SELECT, filterable: false },
};

const SAREE_FIELDS = ["fabric", "weave", "occasion", "pattern", "saree_length", "blouse_piece"];

const tidy = (value) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

/**
 * Canonical spellings per attribute: the old list's spelling when it had the
 * value, else the spelling most products use.
 * @param {{ type: string, label: string, hex?: string, sortOrder?: number, isActive?: boolean }[]} oldValues
 * @param {Record<string, any>[]} products raw legacy products
 */
function collectValues(oldValues, products) {
  /** @type {Map<string, Map<string, { label: string, hex: string, fromList: boolean, isActive: boolean, uses: Map<string, number> }>>} */
  const byKey = new Map();
  const entry = (key, raw, { hex = "", fromList = false, isActive = true } = {}) => {
    const label = tidy(raw);
    if (!label) return;
    const values = byKey.get(key) ?? new Map();
    byKey.set(key, values);
    const lower = label.toLowerCase();
    const current = values.get(lower) ?? { label, hex: "", fromList: false, isActive: true, uses: new Map() };
    if (fromList) {
      current.label = label;
      current.fromList = true;
      current.isActive = isActive;
    }
    if (hex && !current.hex) current.hex = hex;
    if (!fromList) current.uses.set(label, (current.uses.get(label) ?? 0) + 1);
    values.set(lower, current);
  };

  for (const value of [...oldValues].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))) {
    if (UPGRADE_DEFINITIONS[value.type]) entry(value.type, value.label, { hex: value.hex ?? "", fromList: true, isActive: value.isActive !== false });
  }
  for (const product of products) {
    for (const [field, key] of Object.entries(LEGACY_FIELDS)) entry(key, product[field]);
    for (const variant of product.variants ?? []) entry("color", variant.colorName, { hex: variant.colorHex });
  }
  for (const values of byKey.values()) {
    for (const value of values.values()) {
      if (value.fromList || !value.uses.size) continue;
      value.label = [...value.uses].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0];
    }
  }
  return byKey;
}

/**
 * Adds the collected values to the library (creating attributes it lacks).
 * @param {ReturnType<typeof collectValues>} collected
 * @param {boolean} apply
 */
async function upsertAttributes(collected, apply) {
  const existing = new Map((await ProductAttribute.find({ key: { $in: Object.keys(UPGRADE_DEFINITIONS) } })).map((doc) => [doc.key, doc]));
  const report = [];
  let sortOrder = await ProductAttribute.countDocuments({});
  /** @type {Map<string, Record<string, any>>} */
  const attributes = new Map();

  for (const key of Object.keys(UPGRADE_DEFINITIONS)) {
    const values = [...(collected.get(key)?.values() ?? [])];
    let doc = existing.get(key);
    if (!doc && !values.length && key !== "color") continue;
    const definition = UPGRADE_DEFINITIONS[key];
    const preset = ATTRIBUTE_PRESETS[key];
    if (!doc) {
      doc = new ProductAttribute({
        key,
        name: preset?.name ?? key,
        input: definition.input,
        unit: "",
        values: [],
        filterable: definition.filterable,
        visible: true,
        schemaProperty: preset?.schemaProperty ?? "",
        sortOrder: (sortOrder += 1),
      });
    }
    let added = 0;
    if (LISTED_INPUTS.includes(doc.input)) {
      const known = new Set(doc.values.map((value) => value.label.toLowerCase()));
      const used = new Set(doc.values.map((value) => value.slug));
      for (const value of values) {
        if (known.has(value.label.toLowerCase())) continue;
        let slug = slugify(value.label) || "value";
        for (let attempt = 2; used.has(slug); attempt += 1) slug = `${slugify(value.label) || "value"}-${attempt}`;
        used.add(slug);
        known.add(value.label.toLowerCase());
        doc.values.push({ label: value.label, slug, hex: value.hex, isActive: value.isActive, sortOrder: doc.values.length });
        added += 1;
      }
    }
    report.push({ key, name: doc.name, status: doc.isNew ? "created" : added ? "extended" : "unchanged", values: doc.values.length, added });
    if (apply && (doc.isNew || added)) await doc.save();
    attributes.set(key, doc.toObject());
  }
  return { attributes, report };
}

/** The store's Saree type: the one made from the template or by an earlier upgrade, else a new one. */
async function sareeType(attributes, products, apply) {
  const found =
    (await ProductType.findOne({ template: "saree" })) ?? (await ProductType.findOne({ slug: { $in: ["sarees", "saree"] } }));
  if (found) return { type: found.toObject(), status: "exists" };

  const hsnCounts = new Map();
  for (const product of products) if (product.hsnCode) hsnCounts.set(product.hsnCode, (hsnCounts.get(product.hsnCode) ?? 0) + 1);
  const hsnCode = [...hsnCounts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
  let slug = "sarees";
  for (let attempt = 2; await ProductType.exists({ slug }); attempt += 1) slug = `sarees-${attempt}`;
  const type = new ProductType({
    name: "Saree",
    pluralName: "Sarees",
    slug,
    icon: "sparkles",
    description: "",
    isActive: true,
    sortOrder: await ProductType.countDocuments({}),
    fields: SAREE_FIELDS.filter((key) => attributes.has(key)).map((key) => ({ key, required: false })),
    options: attributes.has("color") ? [{ key: "color", values: [] }] : [],
    defaults: { hsnCode, gstRatePercent: null, minimumOrderQuantity: 1, careInstructions: "" },
    template: "saree",
  });
  if (apply) await type.save();
  return { type: type.toObject(), status: "created" };
}

/**
 * The update that converts one legacy product, field by field.
 * @param {Record<string, any>} product raw legacy product
 * @param {Record<string, any>} type
 * @param {Map<string, Record<string, any>>} attributes
 */
function conversionOf(product, type, attributes) {
  const canonical = (key, raw) => {
    const attribute = attributes.get(key);
    const text = tidy(raw);
    if (!attribute || !text) return "";
    const result = canonicalizeValue(attribute, text);
    return "error" in result ? "" : result.value;
  };

  const details = Object.entries(LEGACY_FIELDS)
    .map(([field, key]) => ({ key, value: canonical(key, product[field]) }))
    .filter((entry) => entry.value && type.fields.some((field) => field.key === entry.key));

  const set = {};
  const unset = Object.fromEntries(Object.keys(LEGACY_FIELDS).map((field) => [field, ""]));
  const arrayFilters = [];
  /** @type {Map<string, { color: string, images: any[] }>} */
  const media = new Map();
  const colours = [];

  (product.variants ?? []).forEach((variant, index) => {
    const color = canonical("color", variant.colorName) || tidy(variant.colorName);
    const id = `v${index}`;
    arrayFilters.push({ [`${id}._id`]: variant._id });
    set[`variants.$[${id}].options`] = color ? { color } : {};
    set[`variants.$[${id}].colorName`] = color;
    set[`variants.$[${id}].title`] = color;
    set[`variants.$[${id}].barcode`] = variant.barcode ?? "";
    unset[`variants.$[${id}].images`] = "";
    if (color) colours.push(color);
    if (color && variant.images?.length) {
      const group = media.get(color) ?? { color, images: [] };
      const known = new Set(group.images.map((image) => image.url));
      group.images.push(...variant.images.filter((image) => !known.has(image.url)));
      media.set(color, group);
    }
  });

  const colors = colours.length ? [...new Set(colours)] : product.colors ?? [];
  Object.assign(set, {
    productType: type._id,
    typeHidden: type.isActive === false,
    attributes: details,
    colorMedia: [...media.values()],
    colors,
    sizeRange: "",
    searchText: searchTextOf({ attributes: details, variants: colours.map((color) => ({ options: { color } })), colors }),
  });
  return { set, unset, arrayFilters, colours: media.size };
}

/**
 * Runs (or, without `apply`, only plans) the upgrade for the current store.
 * @param {{ apply?: boolean }} [options]
 */
export async function upgradeLegacyCatalog({ apply = false } = {}) {
  const tenantId = new mongoose.Types.ObjectId(requireTenantId());
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database is not connected.");
  const products = await db.collection("products").find({ tenantId, productType: null }).toArray();
  // The old per-value attribute lists (collection "attributes"), read as they are.
  const oldValues = await db.collection("attributes").find({ tenantId, type: { $exists: true } }).toArray();

  const { attributes, report: attributeReport } = await upsertAttributes(collectValues(oldValues, products), apply);
  const { type, status: typeStatus } = await sareeType(attributes, products, apply);

  let variants = 0;
  let colourGroups = 0;
  const operations = products.map((product) => {
    const conversion = conversionOf(product, type, attributes);
    variants += product.variants?.length ?? 0;
    colourGroups += conversion.colours;
    return {
      updateOne: {
        // Still untyped: a product converted (or edited) meanwhile is left alone.
        filter: { _id: product._id, tenantId, productType: null },
        update: { $set: conversion.set, $unset: conversion.unset },
        ...(conversion.arrayFilters.length ? { arrayFilters: conversion.arrayFilters } : {}),
      },
    };
  });

  let converted = 0;
  if (apply && operations.length) {
    // The raw collection: the update names fields the current schema no longer has ($unset of the old ones).
    for (let index = 0; index < operations.length; index += 200) {
      const result = await db.collection("products").bulkWrite(operations.slice(index, index + 200), { ordered: false });
      converted += result.modifiedCount;
    }
    // Raw writes skip the model hooks that mark the cached catalogue stale.
    invalidateCatalogCache();
  }

  return {
    applied: apply,
    products: products.length,
    converted: apply ? converted : 0,
    variants,
    colourPhotoGroups: colourGroups,
    type: { name: type.name, slug: type.slug, status: typeStatus },
    attributes: attributeReport,
    oldListValues: oldValues.length,
  };
}

/**
 * Brings the catalogue indexes in line with the models: the full-text index
 * now covers detail values (searchText) instead of the old fabric and weave
 * fields, and stock alerts are unique per variant. Indexes are shared by all
 * stores and identical for each, so this is safe from any store; only
 * differing indexes are rebuilt, so repeated calls are cheap.
 */
export async function ensureCatalogIndexes() {
  const collection = Product.collection;
  const indexes = await collection.indexes().catch(() => []);
  const text = indexes.find((index) => index.name === "product_text");
  if (text && !text.weights?.searchText) await collection.dropIndex("product_text");
  const stale = indexes.find((index) => index.name === "tenantId_1_status_1_fabric_1");
  if (stale) await collection.dropIndex(stale.name);
  // Stock alerts became per variant: the old one-alert-per-product unique index would refuse a second size.
  const alertIndexes = await StockAlert.collection.indexes().catch(() => []);
  if (alertIndexes.some((index) => index.name === "tenantId_1_product_1_customer_1")) {
    await StockAlert.collection.dropIndex("tenantId_1_product_1_customer_1");
  }
  await Promise.all([Product.createIndexes(), ProductType.createIndexes(), ProductAttribute.createIndexes(), StockAlert.createIndexes()]);
}
