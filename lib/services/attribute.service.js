import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { slugify } from "@/lib/utils/slugify";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import {
  addAttributeValueSchema,
  attributeKeyFrom,
  createAttributeSchema,
  updateAttributeSchema,
} from "@/lib/validators/catalog-setup.validator";
import { ProductAttribute } from "@/lib/db/models/ProductAttribute";
import { ProductType } from "@/lib/db/models/ProductType";
import { Product } from "@/lib/db/models/Product";
import { HomepageLayout } from "@/lib/db/models/HomepageLayout";
import { ATTRIBUTE_INPUTS, FILTERABLE_INPUTS, LISTED_INPUTS } from "@/lib/constants/catalog";
import { ATTRIBUTE_PRESETS } from "@/lib/catalog/type-templates";

/**
 * The store's attribute library (Admin → Attributes). Products store the
 * canonical value labels kept here, so renaming a value renames it on every
 * product, type and home page collection that uses it, and filters never
 * split one value into two spellings.
 */

const parse = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const errors = formatZodErrors(parsed.error);
    throw new ApiError(422, errors[0]?.message ?? "Validation failed.", errors);
  }
  return parsed.data;
};

const isListed = (input) => LISTED_INPUTS.includes(input);

/** @param {string} attributeId */
async function findAttribute(attributeId) {
  const attribute = mongoose.isValidObjectId(attributeId) ? await ProductAttribute.findById(attributeId) : null;
  if (!attribute) throw new ApiError(404, "Attribute not found.");
  return attribute;
}
const canFilter = (input) => FILTERABLE_INPUTS.includes(input);

/** Products holding `value` for attribute `key`, as a detail or as a variant option. */
const productsWithValue = (key, value) => ({
  $or: [{ attributes: { $elemMatch: { key, value } } }, { [`variants.options.${key}`]: value }],
});

/**
 * Values in the order given, with slugs unique within the attribute.
 * @param {{ _id?: unknown, label: string, hex?: string, isActive?: boolean }[]} values
 */
function withSlugs(values) {
  const used = new Set();
  return values.map((value, index) => {
    const base = slugify(value.label) || "value";
    let slug = base;
    for (let attempt = 2; used.has(slug); attempt += 1) slug = `${base}-${attempt}`;
    used.add(slug);
    return { ...value, slug, sortOrder: index };
  });
}

async function uniqueKey(base) {
  const taken = new Set(
    (await ProductAttribute.find({ key: { $regex: `^${base}(_\\d+)?$` } }).select("key").lean()).map((row) => row.key),
  );
  if (!taken.has(base)) return base;
  for (let attempt = 2; attempt < 100; attempt += 1) {
    const candidate = `${base.slice(0, 28)}_${attempt}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new ApiError(409, "Could not create a unique key for this attribute.");
}

/** Products using each attribute key (as a detail or an option), in one pass over the catalogue. */
async function productCountsByKey() {
  const rows = await Product.aggregate([
    {
      $project: {
        keys: {
          $setUnion: [
            { $ifNull: ["$attributes.key", []] },
            {
              $reduce: {
                input: { $ifNull: ["$variants", []] },
                initialValue: [],
                in: { $setUnion: ["$$value", { $map: { input: { $objectToArray: { $ifNull: ["$$this.options", {}] } }, as: "option", in: "$$option.k" } }] },
              },
            },
          ],
        },
      },
    },
    { $unwind: "$keys" },
    { $group: { _id: "$keys", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.count]));
}

/** Every attribute with the types using it and how many products have a value for it. */
export async function listAttributes() {
  const [attributes, types, counts] = await Promise.all([
    ProductAttribute.find({}).sort({ sortOrder: 1, name: 1 }).lean(),
    ProductType.find({}).select("name fields.key options.key").lean(),
    productCountsByKey(),
  ]);
  return attributes.map((attribute) => ({
    ...attribute,
    usedBy: types.flatMap((type) => {
      if (type.options.some((option) => option.key === attribute.key)) return [{ id: String(type._id), name: type.name, as: "option" }];
      if (type.fields.some((field) => field.key === attribute.key)) return [{ id: String(type._id), name: type.name, as: "detail" }];
      return [];
    }),
    productCount: counts.get(attribute.key) ?? 0,
  }));
}

/** @param {unknown} payload */
export async function createAttribute(payload) {
  const data = parse(createAttributeSchema, payload);
  const key = data.key ?? (await uniqueKey(attributeKeyFrom(data.name)));
  if (data.key && (await ProductAttribute.exists({ key }))) throw new ApiError(409, `An attribute with the key “${key}” already exists.`);
  const listed = isListed(data.input);
  try {
    return await ProductAttribute.create({
      key,
      name: data.name,
      input: data.input,
      unit: data.input === ATTRIBUTE_INPUTS.NUMBER ? data.unit ?? "" : "",
      values: listed ? withSlugs((data.values ?? []).map(({ label, hex, isActive }) => ({ label, hex: hex ?? "", isActive: isActive ?? true }))) : [],
      filterable: canFilter(data.input) && (data.filterable ?? listed),
      visible: data.visible ?? true,
      schemaProperty: data.schemaProperty ?? "",
      helpText: data.helpText ?? "",
      sortOrder: data.sortOrder ?? (await ProductAttribute.countDocuments({})),
    });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, `An attribute with the key “${key}” already exists.`);
    throw error;
  }
}

/**
 * Edits an attribute. `values`, when sent, is the complete list in display
 * order: entries with an `_id` keep it (a changed label is a rename, applied
 * to every product), entries without one are new, and missing ones are
 * deleted, which is refused while a product still uses them.
 * @param {string} attributeId
 * @param {unknown} payload
 */
export async function updateAttribute(attributeId, payload) {
  const data = parse(updateAttributeSchema, payload);
  const attribute = await findAttribute(attributeId);

  /** @type {[string, string][]} */
  const renames = [];
  let removed = [];
  if (data.values && isListed(attribute.input)) {
    const current = new Map(attribute.values.map((value) => [String(value._id), value]));
    const next = data.values.map((input) => {
      const existing = input._id ? current.get(input._id) : null;
      if (!existing) return { label: input.label, hex: input.hex ?? "", isActive: input.isActive ?? true };
      current.delete(input._id);
      if (existing.label !== input.label) renames.push([existing.label, input.label]);
      return { _id: existing._id, label: input.label, hex: input.hex ?? existing.hex, isActive: input.isActive ?? existing.isActive };
    });
    removed = [...current.values()];
    for (const value of removed) {
      if (await Product.exists(productsWithValue(attribute.key, value.label))) {
        throw new ApiError(409, `“${value.label}” is used by products. Deactivate it instead, or change those products first.`, [
          { field: "values", message: `“${value.label}” is in use.` },
        ]);
      }
    }
    attribute.values = withSlugs(next);
  }

  for (const field of ["name", "visible", "schemaProperty", "helpText", "sortOrder"]) {
    if (data[field] !== undefined) attribute[field] = data[field];
  }
  if (data.unit !== undefined && attribute.input === ATTRIBUTE_INPUTS.NUMBER) attribute.unit = data.unit;
  if (data.filterable !== undefined) attribute.filterable = canFilter(attribute.input) && data.filterable;
  await attribute.save();

  await applyRenames(attribute, renames);
  if (removed.length) {
    await ProductType.updateMany(
      { "options.key": attribute.key },
      { $pull: { "options.$[option].values": { $in: removed.map((value) => value.label) } } },
      { arrayFilters: [{ "option.key": attribute.key }] },
    );
  }
  return attribute;
}

/**
 * Renames run one after another; when one rename's new label is another's old
 * one (swapping two labels), every rename goes through a temporary label first.
 * @param {{ key: string, input: string }} attribute
 * @param {[string, string][]} renames
 */
async function applyRenames(attribute, renames) {
  if (!renames.length) return;
  const sources = new Set(renames.map(([from]) => from));
  if (!renames.some(([, to]) => sources.has(to))) {
    for (const [from, to] of renames) await renameAttributeValue(attribute, from, to);
    return;
  }
  const staged = renames.map(([from, to], index) => [from, `⁣rename-${index}-${Date.now()}`, to]);
  for (const [from, temporary] of staged) await renameAttributeValue(attribute, from, temporary);
  for (const [, temporary, to] of staged) await renameAttributeValue(attribute, temporary, to);
}

/**
 * Renames one value wherever the store uses it: product details and variant
 * options (with their titles, colour names and photo groups), product types'
 * option lists and size charts, and home page collections. Orders and quotes
 * keep the label they were placed with.
 * @param {{ key: string, input: string }} attribute
 * @param {string} from
 * @param {string} to
 */
export async function renameAttributeValue(attribute, from, to) {
  const { key } = attribute;
  const isColour = attribute.input === ATTRIBUTE_INPUTS.COLOR;
  const products = await Product.find(productsWithValue(key, from));
  for (const product of products) {
    for (const entry of product.attributes) if (entry.key === key && entry.value === from) entry.value = to;
    for (const variant of product.variants) {
      if (variant.options?.get(key) !== from) continue;
      variant.options.set(key, to);
      if (isColour && variant.colorName === from) variant.colorName = to;
    }
    if (isColour) for (const media of product.colorMedia) if (media.color === from) media.color = to;
    // "S–XXL" or "S, M, L": whole tokens only, so renaming "S" never touches "XS".
    if (product.sizeRange) product.sizeRange = product.sizeRange.split(/(–|, )/).map((token) => (token === from ? to : token)).join("");
    await product.save();
  }

  await Promise.all([
    ProductType.updateMany(
      { options: { $elemMatch: { key, values: from } } },
      { $set: { "options.$[option].values.$[value]": to } },
      { arrayFilters: [{ "option.key": key }, { value: from }] },
    ),
    ProductType.updateMany(
      { "sizeChart.optionKey": key, "sizeChart.rows.size": from },
      { $set: { "sizeChart.rows.$[row].size": to } },
      { arrayFilters: [{ "row.size": from }] },
    ),
    Product.updateMany(
      { "sizeChart.optionKey": key, "sizeChart.rows.size": from },
      { $set: { "sizeChart.rows.$[row].size": to } },
      { arrayFilters: [{ "row.size": from }] },
    ),
    // Collections built on this value: current ones name the attribute; older ones used the key as their kind.
    ...["attribute", "kind"].map((field) =>
      HomepageLayout.updateMany(
        { sections: { $elemMatch: { [`source.${field}`]: key, "source.value": from } } },
        { $set: { "sections.$[section].source.value": to } },
        { arrayFilters: [{ [`section.source.${field}`]: key, "section.source.value": from }] },
      ),
    ),
  ]);
}

/**
 * Adds a value from the product form ("Add “Linen” to Fabric"). A value that
 * already exists, whatever its letter case, is returned instead (and switched
 * back on if it had been deactivated).
 * @param {string} attributeId
 * @param {unknown} payload
 */
export async function addAttributeValue(attributeId, payload) {
  const { label, hex } = parse(addAttributeValueSchema, payload);
  const attribute = await findAttribute(attributeId);
  if (!isListed(attribute.input)) throw new ApiError(422, `${attribute.name} has no list of values.`);

  const existing = attribute.values.find((value) => value.label.toLowerCase() === label.toLowerCase());
  if (existing) {
    // Re-adding a colour that has no swatch yet fills it in; an existing swatch is kept (change it in Admin → Attributes).
    const fillsSwatch = attribute.input === ATTRIBUTE_INPUTS.COLOR && hex && !existing.hex;
    if (!existing.isActive || fillsSwatch) {
      existing.isActive = true;
      if (fillsSwatch) existing.hex = hex;
      await attribute.save();
    }
    return { attribute, value: existing };
  }
  attribute.values = withSlugs([...attribute.values.map((value) => value.toObject()), { label, hex: hex ?? "", isActive: true }]);
  await attribute.save();
  return { attribute, value: attribute.values.at(-1) };
}

/** @param {string} attributeId */
export async function deleteAttribute(attributeId) {
  const attribute = await findAttribute(attributeId);
  const types = await ProductType.find({ $or: [{ "fields.key": attribute.key }, { "options.key": attribute.key }] }).select("name").lean();
  if (types.length) {
    throw new ApiError(409, `${attribute.name} is used by ${types.map((type) => type.name).join(", ")}. Remove it from ${types.length === 1 ? "that type" : "those types"} first.`);
  }
  const inUse = await Product.exists({ $or: [{ "attributes.key": attribute.key }, { [`variants.options.${attribute.key}`]: { $exists: true } }] });
  if (inUse) throw new ApiError(409, `Products still have ${attribute.name} values. Change those products first.`);
  await attribute.deleteOne();
  return { deleted: true };
}

/**
 * Adds the library attributes behind `keys` from the presets: missing ones are
 * created, existing ones gain the preset values they lack (existing spellings
 * and settings are kept). Used when a product type is created from a template.
 * @param {string[]} keys
 */
export async function installAttributePresets(keys) {
  const wanted = [...new Set(keys)].filter((key) => ATTRIBUTE_PRESETS[key]);
  const existing = new Map((await ProductAttribute.find({ key: { $in: wanted } })).map((doc) => [doc.key, doc]));
  let sortOrder = await ProductAttribute.countDocuments({});
  for (const key of wanted) {
    const preset = ATTRIBUTE_PRESETS[key];
    const presetValues = (preset.values ?? []).map((entry) => (Array.isArray(entry) ? { label: entry[0], hex: entry[1] } : { label: entry, hex: "" }));
    const doc = existing.get(key);
    if (!doc) {
      await ProductAttribute.create({
        key,
        name: preset.name,
        input: preset.input,
        unit: preset.unit ?? "",
        values: withSlugs(presetValues.map((value) => ({ ...value, isActive: true }))),
        filterable: canFilter(preset.input) && (preset.filterable ?? false),
        visible: preset.visible ?? true,
        schemaProperty: preset.schemaProperty ?? "",
        helpText: preset.helpText ?? "",
        sortOrder: (sortOrder += 1),
      });
      continue;
    }
    if (!isListed(doc.input)) continue;
    const known = new Set(doc.values.map((value) => value.label.toLowerCase()));
    const additions = presetValues.filter((value) => !known.has(value.label.toLowerCase()));
    if (!additions.length) continue;
    doc.values = withSlugs([...doc.values.map((value) => value.toObject()), ...additions.map((value) => ({ ...value, isActive: true }))]);
    await doc.save();
  }
}
