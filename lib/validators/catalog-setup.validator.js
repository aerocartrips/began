import { z } from "zod";
import {
  ATTRIBUTE_INPUT_VALUES,
  ATTRIBUTE_KEY_PATTERN,
  MAX_ATTRIBUTE_VALUES,
  MAX_SIZE_CHART_COLUMNS,
  MAX_SIZE_CHART_ROWS,
  MAX_TYPE_FIELDS,
  MAX_TYPE_OPTIONS,
  PRODUCT_TYPE_ICONS,
  RESERVED_ATTRIBUTE_KEYS,
  SCHEMA_PROPERTY_VALUES,
} from "@/lib/constants/catalog";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id.");
const hex = z.union([z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour."), z.literal("")]);

/** An attribute key: also a catalogue URL parameter, so the catalogue's own names are refused. */
export const attributeKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(ATTRIBUTE_KEY_PATTERN, "Use lower-case letters, digits and underscores, starting with a letter.")
  .refine((key) => !RESERVED_ATTRIBUTE_KEYS.includes(key), "This key is used by the catalogue's own addresses. Pick another.");

/**
 * Key for an attribute name: "Sleeve length" → "sleeve_length".
 * @param {string} name
 */
export function attributeKeyFrom(name) {
  const base = String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "a_$1")
    .slice(0, 32);
  const key = base || "attribute";
  return RESERVED_ATTRIBUTE_KEYS.includes(key) ? `${key}_value` : key;
}

const valueInputSchema = z.object({
  _id: objectId.optional(),
  label: z.string().trim().min(1, "Values can't be empty.").max(80),
  hex: hex.optional(),
  isActive: z.boolean().optional(),
});

const attributeFields = {
  name: z.string().trim().min(1, "Give the attribute a name.").max(60),
  unit: z.string().trim().max(12).optional(),
  values: z.array(valueInputSchema).max(MAX_ATTRIBUTE_VALUES).optional(),
  filterable: z.boolean().optional(),
  visible: z.boolean().optional(),
  schemaProperty: z.enum(SCHEMA_PROPERTY_VALUES).optional(),
  helpText: z.string().trim().max(200).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
};

/** Values listed twice (whatever their letter case) are one value; the first spelling wins. */
const withUniqueValues = (schema) =>
  schema.superRefine((value, ctx) => {
    const seen = new Set();
    (value.values ?? []).forEach((entry, index) => {
      const label = entry.label.trim().toLowerCase();
      if (seen.has(label)) ctx.addIssue({ code: "custom", path: ["values", index, "label"], message: `“${entry.label}” is listed twice.` });
      seen.add(label);
    });
  });

export const createAttributeSchema = withUniqueValues(
  z.object({ key: attributeKeySchema.optional(), input: z.enum(ATTRIBUTE_INPUT_VALUES), ...attributeFields }),
);

/** Key and input are fixed once created; `values` (when sent) is the full list, matched by `_id`. */
export const updateAttributeSchema = withUniqueValues(z.object(attributeFields).partial());

export const addAttributeValueSchema = z.object({
  label: z.string().trim().min(1, "Enter a value.").max(80),
  hex: hex.optional(),
});

const optionalKey = z.union([attributeKeySchema, z.literal("")]);

export const sizeChartInputSchema = z
  .object({
    optionKey: optionalKey.default(""),
    unit: z.enum(["in", "cm"]).default("in"),
    columns: z
      .array(
        z.object({
          label: z.string().trim().min(1, "Name each measurement.").max(40),
          primary: z.boolean().optional().default(false),
          measurement: z.boolean().optional().default(true),
        }),
      )
      .max(MAX_SIZE_CHART_COLUMNS)
      .default([]),
    rows: z
      .array(
        z.object({
          size: z.string().trim().min(1, "Name each size.").max(40),
          values: z.array(z.string().trim().max(40)).max(MAX_SIZE_CHART_COLUMNS).default([]),
        }),
      )
      .max(MAX_SIZE_CHART_ROWS)
      .default([]),
    note: z.string().trim().max(500).default(""),
    howToMeasure: z
      .array(z.object({ label: z.string().trim().min(1).max(40), text: z.string().trim().max(300).default("") }))
      .max(MAX_SIZE_CHART_COLUMNS)
      .default([]),
  })
  .superRefine((chart, ctx) => {
    if (chart.columns.filter((column) => column.primary).length > 1) {
      ctx.addIssue({ code: "custom", path: ["columns"], message: "Mark one measurement for the fit finder." });
    }
    if (chart.columns.some((column) => column.primary && !column.measurement)) {
      ctx.addIssue({ code: "custom", path: ["columns"], message: "The fit finder needs a measurement column (a length)." });
    }
    const sizes = new Set();
    chart.rows.forEach((row, index) => {
      const size = row.size.toLowerCase();
      if (sizes.has(size)) ctx.addIssue({ code: "custom", path: ["rows", index, "size"], message: `Size “${row.size}” is listed twice.` });
      sizes.add(size);
    });
  });

const typeFields = {
  name: z.string().trim().min(2, "Name the product type (e.g. T-shirt).").max(60),
  pluralName: z.string().trim().max(60).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.")
    .max(80)
    .optional(),
  description: z.string().trim().max(600).optional(),
  icon: z.enum(PRODUCT_TYPE_ICONS).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  fields: z.array(z.object({ key: attributeKeySchema, required: z.boolean().optional().default(false) })).max(MAX_TYPE_FIELDS).optional(),
  options: z
    .array(z.object({ key: attributeKeySchema, values: z.array(z.string().trim().min(1).max(80)).max(MAX_ATTRIBUTE_VALUES).default([]) }))
    .max(MAX_TYPE_OPTIONS, `Up to ${MAX_TYPE_OPTIONS} options.`)
    .optional(),
  sizeChart: sizeChartInputSchema.nullable().optional(),
  /** The type's own storefront photo; null removes it (its most popular product's photo is used). */
  coverImage: z
    .object({
      url: z.string().url().max(2048),
      alt: z.string().trim().max(160).optional().default(""),
      publicId: z.string().trim().max(260).optional().default(""),
    })
    .nullable()
    .optional(),
  defaults: z
    .object({
      hsnCode: z.string().trim().regex(/^(\d{4}|\d{6}|\d{8})?$/, "HSN codes have 4, 6 or 8 digits."),
      gstRatePercent: z.number().min(0).max(28).nullable(),
      minimumOrderQuantity: z.number().int().min(1).max(100000),
      careInstructions: z.string().trim().max(2000),
    })
    .partial()
    .optional(),
};

/** Details and options are separate lists: one attribute can't be both in a type. */
const withDistinctKeys = (schema) =>
  schema.superRefine((value, ctx) => {
    const fieldKeys = (value.fields ?? []).map((field) => field.key);
    const optionKeys = (value.options ?? []).map((option) => option.key);
    fieldKeys.forEach((key, index) => {
      if (fieldKeys.indexOf(key) !== index) ctx.addIssue({ code: "custom", path: ["fields", index, "key"], message: "This detail is listed twice." });
      if (optionKeys.includes(key)) {
        ctx.addIssue({ code: "custom", path: ["fields", index, "key"], message: "This attribute is already an option of the type." });
      }
    });
    optionKeys.forEach((key, index) => {
      if (optionKeys.indexOf(key) !== index) ctx.addIssue({ code: "custom", path: ["options", index, "key"], message: "This option is listed twice." });
    });
    const chartKey = value.sizeChart?.optionKey;
    if (chartKey && value.options && !optionKeys.includes(chartKey)) {
      ctx.addIssue({ code: "custom", path: ["sizeChart", "optionKey"], message: "The size chart must describe one of the type's options." });
    }
  });

export const createProductTypeSchema = withDistinctKeys(z.object(typeFields));
export const updateProductTypeSchema = withDistinctKeys(z.object(typeFields).partial());

export const createFromTemplateSchema = z.object({
  template: z.string().trim().min(1).max(40),
  isActive: z.boolean().optional(),
});
