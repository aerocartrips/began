import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { rememberSlug, slugify, withSlugSuffix } from "@/lib/utils/slugify";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import {
  createFromTemplateSchema,
  createProductTypeSchema,
  updateProductTypeSchema,
} from "@/lib/validators/catalog-setup.validator";
import { ProductType } from "@/lib/db/models/ProductType";
import { ProductAttribute } from "@/lib/db/models/ProductAttribute";
import { Product } from "@/lib/db/models/Product";
import { OPTION_INPUTS, SCHEMA_PROPERTIES } from "@/lib/constants/catalog";
import { findTypeTemplate, typeTemplateSummaries } from "@/lib/catalog/type-templates";
import { installAttributePresets } from "@/lib/services/attribute.service";
import { sizeRangeOf } from "@/lib/catalog/variants";

/**
 * Product types (Admin → Product types): what the store sells, and for each,
 * the details its products describe, the options shoppers choose and the size
 * chart. Turning a type off hides its products from the storefront.
 */

const parse = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const errors = formatZodErrors(parsed.error);
    throw new ApiError(422, errors[0]?.message ?? "Validation failed.", errors);
  }
  return parsed.data;
};

/** "Kurta" → "Kurtas", "Accessory" → "Accessories", "Dress" → "Dresses"; names already plural stay. */
export function pluralOf(name) {
  const trimmed = name.trim();
  if (/(s|x|z|ch|sh)$/i.test(trimmed)) return /(ss|x|z|ch|sh)$/i.test(trimmed) ? `${trimmed}es` : trimmed;
  if (/[^aeiou]y$/i.test(trimmed)) return `${trimmed.slice(0, -1)}ies`;
  return `${trimmed}s`;
}

async function ensureUniqueSlug(value, excludeId) {
  const base = slugify(value) || "products";
  for (let attempt = 1; attempt < 50; attempt += 1) {
    const candidate = withSlugSuffix(base, attempt);
    const filter = { $or: [{ slug: candidate }, { previousSlugs: candidate }] };
    if (excludeId) filter._id = { $ne: excludeId };
    if (!(await ProductType.exists(filter))) return candidate;
  }
  throw new ApiError(409, "Could not create a unique address for this product type.");
}

/** Library attributes by key, for the keys a type uses. */
async function attributesFor(keys) {
  const rows = await ProductAttribute.find({ key: { $in: [...new Set(keys)] } }).lean();
  return new Map(rows.map((row) => [row.key, row]));
}

/**
 * Checks a type's details and options against the attribute library and
 * returns them with option values in their canonical spelling.
 * @param {{ fields?: { key: string, required?: boolean }[], options?: { key: string, values?: string[] }[], sizeChart?: any }} data
 */
async function resolveAgainstLibrary(data) {
  const fields = data.fields ?? [];
  const options = data.options ?? [];
  const attributes = await attributesFor([...fields.map((field) => field.key), ...options.map((option) => option.key)]);
  const errors = [];

  fields.forEach((field, index) => {
    if (!attributes.has(field.key)) errors.push({ field: `fields.${index}.key`, message: `There is no “${field.key}” attribute.` });
  });
  const resolvedOptions = options.map((option, index) => {
    const attribute = attributes.get(option.key);
    if (!attribute) {
      errors.push({ field: `options.${index}.key`, message: `There is no “${option.key}” attribute.` });
      return option;
    }
    if (!OPTION_INPUTS.includes(attribute.input)) {
      errors.push({ field: `options.${index}.key`, message: `${attribute.name} can't be an option: options need a one-value list (or colours).` });
      return option;
    }
    const byLower = new Map(attribute.values.map((value) => [value.label.toLowerCase(), value.label]));
    const values = [];
    for (const raw of option.values ?? []) {
      const label = byLower.get(raw.trim().toLowerCase());
      if (!label) errors.push({ field: `options.${index}.values`, message: `“${raw}” isn't one of the ${attribute.name} values.` });
      else if (!values.includes(label)) values.push(label);
    }
    return { key: option.key, values };
  });

  if (errors.length) throw new ApiError(422, errors[0].message, errors);
  return { fields: fields.map((field) => ({ key: field.key, required: Boolean(field.required) })), options: resolvedOptions, attributes };
}

/** The option a type's size chart describes: the chart's own, else the first option meaning "size". */
export function sizeOptionKeyOf(type, attributes) {
  if (type.sizeChart?.optionKey) return type.sizeChart.optionKey;
  return type.options?.find((option) => attributes.get(option.key)?.schemaProperty === SCHEMA_PROPERTIES.SIZE)?.key ?? "";
}

/** A size chart as stored: rows' values padded or cut to the column count. */
function normalizeChart(chart) {
  if (!chart) return null;
  const width = chart.columns.length;
  return {
    ...chart,
    rows: chart.rows.map((row) => ({ size: row.size, values: Array.from({ length: width }, (_, index) => row.values[index] ?? "") })),
  };
}

const toPublicType = (type, counts) => ({
  ...type,
  id: String(type._id),
  productCount: counts?.total ?? 0,
  listedCount: counts?.listed ?? 0,
});

/** Every product type with product counts, the templates to add more, and how many products have no type yet. */
export async function listProductTypes() {
  const [types, counts] = await Promise.all([
    ProductType.find({}).sort({ sortOrder: 1, name: 1 }).lean(),
    Product.aggregate([
      {
        $group: {
          _id: "$productType",
          total: { $sum: 1 },
          listed: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const byType = new Map(counts.map((row) => [String(row._id), row]));
  return {
    types: types.map((type) => toPublicType(type, byType.get(String(type._id)))),
    untypedCount: byType.get("null")?.total ?? 0,
    templates: typeTemplateSummaries(),
  };
}

/** @param {string} typeId */
export async function getProductType(typeId) {
  if (!mongoose.isValidObjectId(typeId)) throw new ApiError(404, "Product type not found.");
  const type = await ProductType.findById(typeId).lean();
  if (!type) throw new ApiError(404, "Product type not found.");
  const [total, listed] = await Promise.all([
    Product.countDocuments({ productType: type._id }),
    Product.countDocuments({ productType: type._id, status: "active" }),
  ]);
  return toPublicType(type, { total, listed });
}

/** @param {unknown} payload */
export async function createProductType(payload) {
  const data = parse(createProductTypeSchema, payload);
  const resolved = await resolveAgainstLibrary(data);
  const pluralName = data.pluralName || pluralOf(data.name);
  const type = await ProductType.create({
    name: data.name,
    pluralName,
    slug: await ensureUniqueSlug(data.slug || pluralName),
    description: data.description ?? "",
    icon: data.icon ?? "package",
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder ?? (await ProductType.countDocuments({})),
    fields: resolved.fields,
    options: resolved.options,
    sizeChart: normalizeChart(data.sizeChart ?? null),
    coverImage: data.coverImage ?? null,
    defaults: { hsnCode: "", gstRatePercent: null, minimumOrderQuantity: 1, careInstructions: "", ...data.defaults },
  });
  return type;
}

/**
 * Creates a type from a template (lib/catalog/type-templates.js), adding the
 * attributes it needs to the library first. A second copy of the same
 * template gets a numbered name ("T-shirt 2") so both can be told apart.
 * @param {unknown} payload
 */
export async function createProductTypeFromTemplate(payload) {
  const { template: key, isActive } = parse(createFromTemplateSchema, payload);
  const template = findTypeTemplate(key);
  if (!template) throw new ApiError(404, "Template not found.");

  await installAttributePresets([...template.fields.map(([fieldKey]) => fieldKey), ...template.options.map((option) => option.key)]);
  const taken = new Set((await ProductType.find({}).select("name").lean()).map((type) => type.name.toLowerCase()));
  let name = template.name;
  let pluralName = template.pluralName;
  for (let attempt = 2; taken.has(name.toLowerCase()); attempt += 1) {
    name = `${template.name} ${attempt}`;
    pluralName = `${template.pluralName} ${attempt}`;
  }

  const chart = template.sizeChart;
  const type = await createProductType({
    name,
    pluralName,
    description: template.description,
    icon: template.icon,
    isActive: isActive ?? true,
    fields: template.fields.map(([fieldKey, required]) => ({ key: fieldKey, required: Boolean(required) })),
    options: template.options.map((option) => ({ key: option.key, values: option.values ?? [] })),
    sizeChart: chart
      ? {
          optionKey: chart.optionKey,
          unit: chart.unit,
          columns: chart.columns.map((column) => ({ label: column.label, primary: Boolean(column.primary), measurement: column.measurement ?? true })),
          rows: chart.rows.map(([size, ...values]) => ({ size, values })),
          note: chart.note,
          howToMeasure: chart.howToMeasure,
        }
      : null,
    defaults: template.defaults ?? {},
  });
  type.template = template.key;
  await type.save();
  return type;
}

/**
 * Values each product of the type uses for `key`, to refuse type edits that
 * would leave products with options the type no longer offers.
 * @param {unknown} typeId
 * @param {string} key
 */
async function optionValuesInUse(typeId, key) {
  const rows = await Product.aggregate([
    { $match: { productType: typeId, [`variants.options.${key}`]: { $exists: true } } },
    { $unwind: "$variants" },
    { $group: { _id: `$variants.options.${key}` } },
  ]);
  return rows.map((row) => row._id).filter((value) => typeof value === "string");
}

/**
 * @param {string} typeId
 * @param {unknown} payload
 */
export async function updateProductType(typeId, payload) {
  const data = parse(updateProductTypeSchema, payload);
  if (!mongoose.isValidObjectId(typeId)) throw new ApiError(404, "Product type not found.");
  const type = await ProductType.findById(typeId);
  if (!type) throw new ApiError(404, "Product type not found.");
  const wasActive = type.isActive;

  const merged = {
    fields: data.fields ?? type.fields.map((field) => ({ key: field.key, required: field.required })),
    options: data.options ?? type.options.map((option) => ({ key: option.key, values: [...option.values] })),
  };
  const resolved = await resolveAgainstLibrary(merged);
  // Options products still use can't be dropped, nor can values they still have.
  const nextOptions = new Map(resolved.options.map((option) => [option.key, option]));
  for (const option of type.options) {
    const inUse = await optionValuesInUse(type._id, option.key);
    if (!inUse.length) continue;
    const next = nextOptions.get(option.key);
    if (!next) {
      const attribute = resolved.attributes.get(option.key);
      throw new ApiError(409, `Products of this type still have a ${attribute?.name ?? option.key}. Remove it from their variants first.`, [
        { field: "options", message: "Option in use." },
      ]);
    }
    const stillOffered = (value) => next.values.length === 0 || next.values.includes(value);
    const dropped = inUse.filter((value) => !stillOffered(value));
    if (dropped.length) {
      throw new ApiError(409, `${dropped.slice(0, 5).join(", ")} ${dropped.length === 1 ? "is" : "are"} still used by products of this type.`, [
        { field: `options.${resolved.options.indexOf(next)}.values`, message: "Values in use." },
      ]);
    }
  }

  // After the in-use checks: "products still have a Size" says more than "the chart has no option".
  const chart = data.sizeChart === undefined ? type.sizeChart?.toObject?.() ?? type.sizeChart : data.sizeChart;
  if (chart?.optionKey && !resolved.options.some((option) => option.key === chart.optionKey)) {
    throw new ApiError(422, "The size chart must describe one of the type's options.", [{ field: "sizeChart.optionKey", message: "Pick one of the type's options." }]);
  }

  if (data.name !== undefined) type.name = data.name;
  if (data.pluralName !== undefined) type.pluralName = data.pluralName || pluralOf(type.name);
  if (data.slug && data.slug !== type.slug) {
    const slug = await ensureUniqueSlug(data.slug, type._id);
    type.previousSlugs = rememberSlug(type.previousSlugs, type.slug, slug);
    type.slug = slug;
  }
  for (const field of ["description", "icon", "isActive", "sortOrder"]) {
    if (data[field] !== undefined) type[field] = data[field];
  }
  type.fields = resolved.fields;
  type.options = resolved.options;
  if (data.sizeChart !== undefined) type.sizeChart = normalizeChart(data.sizeChart);
  if (data.coverImage !== undefined) type.coverImage = data.coverImage;
  if (data.defaults) Object.assign(type.defaults, data.defaults);
  await type.save();

  if (wasActive !== type.isActive) await Product.updateMany({ productType: type._id }, { $set: { typeHidden: !type.isActive } });
  if (data.options !== undefined || data.sizeChart !== undefined) await refreshSizeRanges(type);
  return type;
}

/**
 * Product cards show the sizes on offer ("S–XXL"), in the type's size order;
 * recomputed for the type's products when its options or chart change.
 * Only that field is written, so stock changes made meanwhile are untouched.
 * @param {Record<string, any>} type
 */
async function refreshSizeRanges(type) {
  const attributes = await attributesFor(type.options.map((option) => option.key));
  const key = sizeOptionKeyOf(type, attributes);
  const order = key ? sizeOrderOf(type, attributes, key) : [];
  const products = await Product.find({ productType: type._id }).select("variants.options sizeRange").lean();
  const updates = products
    .map((product) => {
      const sizeRange = key ? sizeRangeOf(product.variants.map((variant) => variant.options?.[key]), order) : "";
      return sizeRange === product.sizeRange ? null : { updateOne: { filter: { _id: product._id }, update: { $set: { sizeRange } } } };
    })
    .filter(Boolean);
  if (updates.length) await Product.bulkWrite(updates, { ordered: false });
}

/** The order sizes are shown in: the type's own list, else the attribute's. */
export function sizeOrderOf(type, attributes, key) {
  const option = type.options?.find((entry) => entry.key === key);
  if (option?.values?.length) return option.values;
  return (attributes.get(key)?.values ?? []).map((value) => value.label);
}

/**
 * What the store sells (Admin → Store settings → What you sell): `typeIds`
 * become the types on sale and every other type is switched off (its
 * products hidden, not changed). `templates` are kinds the store doesn't have
 * yet, created from their templates and put on sale too. Repeating the same
 * request changes nothing: a template the store already has (a retried save,
 * a second tab) reuses that type instead of adding "T-shirt 2".
 * @param {string[]} typeIds
 * @param {string[]} [templates]
 */
export async function setSellingTypes(typeIds, templates = []) {
  const selling = new Set(typeIds.filter((id) => mongoose.isValidObjectId(id)));
  for (const key of [...new Set(templates)]) {
    const existing = await ProductType.findOne({ template: key }).sort({ createdAt: 1 }).select("_id").lean();
    const id = existing?._id ?? (await createProductTypeFromTemplate({ template: key, isActive: true }))._id;
    selling.add(String(id));
  }
  const types = await ProductType.find({}).select("isActive");
  for (const type of types) {
    const active = selling.has(String(type._id));
    if (type.isActive === active) continue;
    type.isActive = active;
    await type.save();
    await Product.updateMany({ productType: type._id }, { $set: { typeHidden: !active } });
  }
  return listProductTypes();
}

/** @param {string} typeId */
export async function deleteProductType(typeId) {
  if (!mongoose.isValidObjectId(typeId)) throw new ApiError(404, "Product type not found.");
  const type = await ProductType.findById(typeId);
  if (!type) throw new ApiError(404, "Product type not found.");
  const count = await Product.countDocuments({ productType: type._id });
  if (count) {
    throw new ApiError(409, `${count} ${count === 1 ? "product is" : "products are"} ${type.name}. Move them to another type, or turn ${type.pluralName} off instead.`);
  }
  await type.deleteOne();
  return { deleted: true };
}
