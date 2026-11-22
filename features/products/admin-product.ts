import type { ManagedImage } from "@/components/images/image-uploader";
import type { AdminAttribute, AdminProductType, AdminSizeChart } from "@/features/products/catalog-setup";
import { combinationKey, optionCombinations, variantSkuOf } from "@/lib/catalog/variants";

type AdminImageRecord = { url?: string; secureUrl?: string; publicId?: string; alt?: string; isPrimary?: boolean; sortOrder?: number };

/** Product document as returned by /api/v1/products (admin). Amounts are rupees. */
export type AdminProductRecord = {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  productType?: string | { _id?: string; name?: string; pluralName?: string; isActive?: boolean } | null;
  typeHidden?: boolean;
  description?: string;
  shortDescription?: string;
  category?: { _id?: string; name?: string } | string | null;
  images?: AdminImageRecord[];
  attributes?: { key: string; value: string }[];
  colors?: string[];
  sizeRange?: string;
  careInstructions?: string;
  variants?: {
    _id?: string;
    options?: Record<string, string>;
    title?: string;
    colorName?: string;
    colorHex?: string;
    sku: string;
    barcode?: string;
    stockQuantity: number;
    images?: AdminImageRecord[];
    sortOrder?: number;
  }[];
  colorMedia?: { color: string; images: AdminImageRecord[] }[];
  sizeChart?: AdminSizeChart | null;
  price: number;
  compareAtPrice?: number;
  wholesalePrice: number;
  bulkPricingTiers?: { minQuantity: number; pricePerUnit: number }[];
  minimumOrderQuantity?: number;
  stockQuantity?: number;
  hsnCode?: string;
  gstRatePercent?: number | null;
  status?: string;
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt?: string;
};

export type VariantDraft = {
  key: string;
  _id?: string;
  /** Option key → value, e.g. { color: "Red", size: "M" }. */
  options: Record<string, string>;
  sku: string;
  barcode: string;
  stockQuantity: string;
  /** Stock as loaded, so saving never overwrites sales made while the form was open. */
  stockBaseline?: number;
};

export type TierDraft = { key: string; minQuantity: string; pricePerUnit: string };

/** Form state: numbers are kept as strings while editing. */
export type AdminProductDraft = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  productType: string;
  categoryId: string;
  status: string;
  featured: boolean;
  shortDescription: string;
  description: string;
  /** Detail values by attribute key (arrays for multi-select). */
  attributes: Record<string, string | string[]>;
  careInstructions: string;
  price: string;
  compareAtPrice: string;
  wholesalePrice: string;
  minimumOrderQuantity: string;
  stockQuantity: string;
  /** Stock as loaded, so saving never overwrites sales made while the form was open. */
  stockBaseline?: number;
  tiers: TierDraft[];
  /** Values chosen per option; every combination of them is a variant. */
  optionValues: Record<string, string[]>;
  variants: VariantDraft[];
  /** Swatch per colour, when it differs from the colour's library swatch. */
  colorHex: Record<string, string>;
  /** Photos per colour, shared by that colour's sizes. */
  colorMedia: Record<string, ManagedImage[]>;
  hsnCode: string;
  gstRatePercent: string;
  images: ManagedImage[];
  /** This product's own size chart; null uses the type's. */
  sizeChart: AdminSizeChart | null;
  seoTitle: string;
  seoDescription: string;
};

let keySeed = 0;
export const draftKey = () => `k${Date.now().toString(36)}${(keySeed += 1)}`;

const toManaged = (images: AdminImageRecord[] = []): ManagedImage[] =>
  [...images]
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    .map((image) => ({
      src: image.secureUrl || image.url || "",
      secureUrl: image.secureUrl || image.url,
      publicId: image.publicId,
      alt: image.alt ?? "",
      isPrimary: image.isPrimary,
    }))
    .filter((image) => image.src);

const text = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

const idOf = (value: AdminProductRecord["productType"]) => (typeof value === "string" ? value : value?._id ?? "");

/** The colour option of a type: the first option whose attribute is a colour. */
export function colorKeyOf(type: AdminProductType | null, attributes: Map<string, AdminAttribute>) {
  return type?.options.find((option) => attributes.get(option.key)?.input === "color")?.key ?? null;
}

/** A new product of `type`, starting from the type's defaults. */
export function emptyDraft(type: AdminProductType | null = null): AdminProductDraft {
  return {
    name: "",
    slug: "",
    sku: "",
    productType: type?.id ?? "",
    categoryId: "",
    status: "draft",
    featured: false,
    shortDescription: "",
    description: "",
    attributes: {},
    careInstructions: type?.defaults.careInstructions ?? "",
    price: "",
    compareAtPrice: "",
    wholesalePrice: "",
    minimumOrderQuantity: String(type?.defaults.minimumOrderQuantity ?? 1),
    stockQuantity: "0",
    tiers: [],
    optionValues: {},
    variants: [],
    colorHex: {},
    colorMedia: {},
    hsnCode: type?.defaults.hsnCode ?? "",
    gstRatePercent: text(type?.defaults.gstRatePercent),
    images: [],
    sizeChart: null,
    seoTitle: "",
    seoDescription: "",
  };
}

/**
 * The form's state for a saved product. Option values come from its
 * variants; colour photos from its photo groups (or, for products saved
 * before the catalogue upgrade, from the variants themselves).
 */
export function toDraft(record: AdminProductRecord, types: AdminProductType[], attributes: Map<string, AdminAttribute>): AdminProductDraft {
  const categoryId = typeof record.category === "string" ? record.category : record.category?._id ?? "";
  const productType = idOf(record.productType);
  const type = types.find((entry) => entry.id === productType) ?? null;
  const colorKey = colorKeyOf(type, attributes);

  const record_: Record<string, string | string[]> = {};
  for (const entry of record.attributes ?? []) {
    if (attributes.get(entry.key)?.input === "multiselect") {
      const list = Array.isArray(record_[entry.key]) ? (record_[entry.key] as string[]) : [];
      record_[entry.key] = [...list, entry.value];
    } else if (record_[entry.key] === undefined) {
      record_[entry.key] = entry.value;
    }
  }

  const variants = [...(record.variants ?? [])].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  const optionValues: Record<string, string[]> = {};
  for (const option of type?.options ?? []) {
    const values = [...new Set(variants.map((variant) => variant.options?.[option.key]).filter((value): value is string => Boolean(value)))];
    if (values.length) optionValues[option.key] = values;
  }

  const colorMedia: Record<string, ManagedImage[]> = {};
  for (const media of record.colorMedia ?? []) colorMedia[media.color] = toManaged(media.images);
  const colorHex: Record<string, string> = {};
  for (const variant of variants) {
    const colour = (colorKey ? variant.options?.[colorKey] : "") || variant.colorName || "";
    if (!colour) continue;
    if (variant.colorHex && !colorHex[colour]) colorHex[colour] = variant.colorHex;
    if (!colorMedia[colour] && variant.images?.length) colorMedia[colour] = toManaged(variant.images);
  }

  return {
    id: record._id,
    name: record.name,
    slug: record.slug,
    sku: record.sku,
    productType,
    categoryId,
    status: record.status ?? "draft",
    featured: Boolean(record.featured),
    shortDescription: record.shortDescription ?? "",
    description: record.description ?? "",
    attributes: record_,
    careInstructions: record.careInstructions ?? "",
    price: text(record.price),
    compareAtPrice: record.compareAtPrice ? text(record.compareAtPrice) : "",
    wholesalePrice: text(record.wholesalePrice),
    minimumOrderQuantity: text(record.minimumOrderQuantity ?? 1),
    stockQuantity: text(record.stockQuantity ?? 0),
    stockBaseline: record.stockQuantity ?? 0,
    tiers: (record.bulkPricingTiers ?? []).map((tier) => ({ key: draftKey(), minQuantity: text(tier.minQuantity), pricePerUnit: text(tier.pricePerUnit) })),
    optionValues,
    variants: variants.map((variant) => ({
      key: draftKey(),
      _id: variant._id,
      options: { ...(variant.options ?? {}) },
      sku: variant.sku,
      barcode: variant.barcode ?? "",
      stockQuantity: text(variant.stockQuantity),
      stockBaseline: variant.stockQuantity,
    })),
    colorHex,
    colorMedia,
    hsnCode: record.hsnCode ?? "",
    gstRatePercent: text(record.gstRatePercent),
    images: toManaged(record.images),
    sizeChart: record.sizeChart ?? null,
    seoTitle: record.seoTitle ?? "",
    seoDescription: record.seoDescription ?? "",
  };
}

/**
 * The variants for the chosen option values: every combination, in the
 * type's option order. Combinations that already exist keep their id, SKU
 * and stock; new ones get a SKU from the product SKU and their values.
 */
export function variantsFor(draft: AdminProductDraft, type: AdminProductType | null): VariantDraft[] {
  if (!type?.options.length) return [];
  const options = type.options.map((option) => ({ key: option.key, values: draft.optionValues[option.key] ?? [] }));
  if (options.some((option) => !option.values.length)) return [];
  const existing = new Map(draft.variants.map((variant) => [combinationKey(variant.options), variant]));
  return optionCombinations(options).map((combo) => {
    const kept = existing.get(combinationKey(combo));
    if (kept) return { ...kept, options: combo };
    return { key: draftKey(), options: combo, sku: variantSkuOf(draft.sku || "SKU", Object.values(combo)), barcode: "", stockQuantity: "0" };
  });
}

const toImagePayload = (images: ManagedImage[], fallbackAlt: string) =>
  images.map((image, index) => ({
    url: image.secureUrl || image.src,
    alt: image.alt || fallbackAlt,
    isPrimary: index === 0,
    sortOrder: index,
    ...(image.publicId ? { publicId: image.publicId } : {}),
  }));

const toNumber = (value: string) => (value.trim() === "" ? undefined : Number(value));

/** API payload for POST/PATCH /api/v1/products. */
export function toPayload(draft: AdminProductDraft, type: AdminProductType | null, attributes: Map<string, AdminAttribute>) {
  const colorKey = colorKeyOf(type, attributes);
  const details = Object.fromEntries(
    Object.entries(draft.attributes)
      .map(([key, value]) => [key, Array.isArray(value) ? value.filter(Boolean) : String(value ?? "").trim()] as const)
      .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value !== "")),
  );
  const colours = new Set(colorKey ? draft.variants.map((variant) => variant.options[colorKey]).filter(Boolean) : []);

  return {
    name: draft.name.trim(),
    ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
    sku: draft.sku.trim(),
    productType: draft.productType,
    category: draft.categoryId,
    status: draft.status,
    featured: draft.featured,
    shortDescription: draft.shortDescription.trim(),
    description: draft.description.trim(),
    attributes: details,
    careInstructions: draft.careInstructions.trim(),
    price: Number(draft.price),
    compareAtPrice: toNumber(draft.compareAtPrice) ?? 0,
    wholesalePrice: Number(draft.wholesalePrice),
    minimumOrderQuantity: Number(draft.minimumOrderQuantity) || 1,
    stockQuantity: Number(draft.stockQuantity) || 0,
    ...(draft.stockBaseline !== undefined ? { stockBaseline: draft.stockBaseline } : {}),
    bulkPricingTiers: draft.tiers
      .filter((tier) => tier.minQuantity && tier.pricePerUnit)
      .map((tier) => ({ minQuantity: Number(tier.minQuantity), pricePerUnit: Number(tier.pricePerUnit) })),
    variants: draft.variants.map((variant, index) => {
      const colour = colorKey ? variant.options[colorKey] : "";
      return {
        ...(variant._id ? { _id: variant._id } : {}),
        options: variant.options,
        sku: variant.sku.trim(),
        barcode: variant.barcode.trim(),
        stockQuantity: Number(variant.stockQuantity) || 0,
        ...(variant._id && variant.stockBaseline !== undefined ? { stockBaseline: variant.stockBaseline } : {}),
        ...(colour && draft.colorHex[colour] ? { colorHex: draft.colorHex[colour] } : {}),
        sortOrder: index,
      };
    }),
    colorMedia: Object.entries(draft.colorMedia)
      .filter(([colour, images]) => colours.has(colour) && images.length)
      .map(([colour, images]) => ({ color: colour, images: toImagePayload(images, `${draft.name} in ${colour}`) })),
    sizeChart: draft.sizeChart,
    hsnCode: draft.hsnCode.trim(),
    gstRatePercent: draft.gstRatePercent.trim() === "" ? null : Number(draft.gstRatePercent),
    images: toImagePayload(draft.images, draft.name),
    seoTitle: draft.seoTitle.trim(),
    seoDescription: draft.seoDescription.trim(),
  };
}
