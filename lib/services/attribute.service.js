import { z } from "zod";
import { ApiError } from "@/lib/utils/api-error";
import { slugify } from "@/lib/utils/slugify";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { Attribute } from "@/lib/db/models/Attribute";
import { Product } from "@/lib/db/models/Product";
import { ATTRIBUTE_PRODUCT_FIELD, ATTRIBUTE_TYPES, ATTRIBUTE_TYPE_VALUES } from "@/lib/constants/catalog";

const attributeSchema = z.object({
  type: z.enum(ATTRIBUTE_TYPE_VALUES),
  label: z.string().trim().min(1).max(80),
  hex: z.union([z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour."), z.literal("")]).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});

const parse = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  return parsed.data;
};

export async function listAttributes() {
  return Attribute.find({}).sort({ type: 1, sortOrder: 1, label: 1 }).lean();
}

export async function createAttribute(payload) {
  const data = parse(attributeSchema, payload);
  try {
    return await Attribute.create({ ...data, slug: slugify(data.label) });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, `“${data.label}” already exists.`);
    throw error;
  }
}

/**
 * Renaming a value updates every product that uses it, so filters stay consistent.
 * @param {string} attributeId
 */
export async function updateAttribute(attributeId, payload) {
  const data = parse(attributeSchema.partial().omit({ type: true }), payload);
  const attribute = await Attribute.findById(attributeId);
  if (!attribute) throw new ApiError(404, "Attribute not found.");
  const previousLabel = attribute.label;
  Object.assign(attribute, data);
  if (data.label) attribute.slug = slugify(data.label);
  await attribute.save();

  if (data.label && data.label !== previousLabel) {
    const field = ATTRIBUTE_PRODUCT_FIELD[attribute.type];
    if (attribute.type === ATTRIBUTE_TYPES.COLOR) {
      await Product.updateMany({ colors: previousLabel }, { $set: { "colors.$[value]": data.label } }, { arrayFilters: [{ value: previousLabel }] });
      await Product.updateMany(
        { "variants.colorName": previousLabel },
        { $set: { "variants.$[variant].colorName": data.label } },
        { arrayFilters: [{ "variant.colorName": previousLabel }] },
      );
    } else {
      await Product.updateMany({ [field]: previousLabel }, { $set: { [field]: data.label } });
    }
  }
  return attribute;
}

export async function deleteAttribute(attributeId) {
  const attribute = await Attribute.findById(attributeId);
  if (!attribute) throw new ApiError(404, "Attribute not found.");
  const field = ATTRIBUTE_PRODUCT_FIELD[attribute.type];
  const inUse = await Product.exists({ [field]: attribute.label });
  if (inUse) {
    throw new ApiError(409, `“${attribute.label}” is used by products. Deactivate it instead, or change those products first.`);
  }
  await attribute.deleteOne();
  return { deleted: true };
}

/**
 * Replaces attribute values on a product payload with the store's canonical
 * labels ("banarasi silk" → "Banarasi Silk"). Unknown values are rejected once
 * a store has defined a list for that attribute; stores without lists accept
 * free text, so onboarding is not blocked.
 * @param {Record<string, any>} data validated product payload (mutated)
 */
export async function canonicalizeProductAttributes(data) {
  const attributes = await Attribute.find({ isActive: true }).select("type label").lean();
  const byType = new Map();
  for (const attribute of attributes) {
    if (!byType.has(attribute.type)) byType.set(attribute.type, new Map());
    byType.get(attribute.type).set(attribute.label.toLowerCase(), attribute.label);
  }

  const errors = [];
  const canonical = (type, value, field) => {
    if (!value) return value;
    const list = byType.get(type);
    if (!list) return value.trim();
    const label = list.get(value.trim().toLowerCase());
    if (!label) errors.push({ field, message: `“${value}” is not in the store's ${type} list.` });
    return label ?? value;
  };

  for (const type of [ATTRIBUTE_TYPES.FABRIC, ATTRIBUTE_TYPES.WEAVE, ATTRIBUTE_TYPES.OCCASION, ATTRIBUTE_TYPES.PATTERN]) {
    const field = ATTRIBUTE_PRODUCT_FIELD[type];
    if (data[field] !== undefined) data[field] = canonical(type, data[field], field);
  }
  if (data.colors) data.colors = data.colors.map((color, index) => canonical(ATTRIBUTE_TYPES.COLOR, color, `colors.${index}`));
  if (data.variants) {
    data.variants = data.variants.map((variant, index) => ({
      ...variant,
      colorName: canonical(ATTRIBUTE_TYPES.COLOR, variant.colorName, `variants.${index}.colorName`),
    }));
  }

  if (errors.length) throw new ApiError(422, errors[0].message, errors);
  return data;
}
