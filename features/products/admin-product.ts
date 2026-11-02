import type { ManagedImage } from "@/components/images/image-uploader";

/** Product document as returned by /api/v1/products (admin). Amounts are rupees. */
export type AdminProductRecord = {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  description?: string;
  shortDescription?: string;
  category?: { _id?: string; name?: string } | string | null;
  images?: AdminImageRecord[];
  fabric?: string;
  weavingType?: string;
  occasion?: string;
  design?: string;
  colors?: string[];
  sareeLength?: string;
  blousePiece?: string;
  careInstructions?: string;
  variants?: {
    _id?: string;
    colorName: string;
    colorHex: string;
    sku: string;
    stockQuantity: number;
    images?: AdminImageRecord[];
    sortOrder?: number;
  }[];
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

type AdminImageRecord = { url?: string; secureUrl?: string; publicId?: string; alt?: string; isPrimary?: boolean; sortOrder?: number };

export type VariantDraft = {
  key: string;
  _id?: string;
  colorName: string;
  colorHex: string;
  sku: string;
  stockQuantity: string;
  images: ManagedImage[];
};

export type TierDraft = { key: string; minQuantity: string; pricePerUnit: string };

/** Form state: numbers are kept as strings while editing. */
export type AdminProductDraft = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  status: string;
  featured: boolean;
  shortDescription: string;
  description: string;
  fabric: string;
  weavingType: string;
  occasion: string;
  design: string;
  colors: string[];
  sareeLength: string;
  blousePiece: string;
  careInstructions: string;
  price: string;
  compareAtPrice: string;
  wholesalePrice: string;
  minimumOrderQuantity: string;
  stockQuantity: string;
  tiers: TierDraft[];
  variants: VariantDraft[];
  hsnCode: string;
  gstRatePercent: string;
  images: ManagedImage[];
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

export function emptyDraft(): AdminProductDraft {
  return {
    name: "", slug: "", sku: "", categoryId: "", status: "draft", featured: false,
    shortDescription: "", description: "", fabric: "", weavingType: "", occasion: "", design: "", colors: [],
    sareeLength: "6.3 m", blousePiece: "Included", careInstructions: "",
    price: "", compareAtPrice: "", wholesalePrice: "", minimumOrderQuantity: "1", stockQuantity: "0",
    tiers: [], variants: [], hsnCode: "", gstRatePercent: "", images: [], seoTitle: "", seoDescription: "",
  };
}

export function toDraft(record: AdminProductRecord): AdminProductDraft {
  const categoryId = typeof record.category === "string" ? record.category : record.category?._id ?? "";
  return {
    id: record._id,
    name: record.name,
    slug: record.slug,
    sku: record.sku,
    categoryId,
    status: record.status ?? "draft",
    featured: Boolean(record.featured),
    shortDescription: record.shortDescription ?? "",
    description: record.description ?? "",
    fabric: record.fabric ?? "",
    weavingType: record.weavingType ?? "",
    occasion: record.occasion ?? "",
    design: record.design ?? "",
    colors: record.colors ?? [],
    sareeLength: record.sareeLength ?? "",
    blousePiece: record.blousePiece ?? "",
    careInstructions: record.careInstructions ?? "",
    price: text(record.price),
    compareAtPrice: record.compareAtPrice ? text(record.compareAtPrice) : "",
    wholesalePrice: text(record.wholesalePrice),
    minimumOrderQuantity: text(record.minimumOrderQuantity ?? 1),
    stockQuantity: text(record.stockQuantity ?? 0),
    tiers: (record.bulkPricingTiers ?? []).map((tier) => ({
      key: draftKey(),
      minQuantity: text(tier.minQuantity),
      pricePerUnit: text(tier.pricePerUnit),
    })),
    variants: [...(record.variants ?? [])]
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
      .map((variant) => ({
        key: draftKey(),
        _id: variant._id,
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        sku: variant.sku,
        stockQuantity: text(variant.stockQuantity),
        images: toManaged(variant.images),
      })),
    hsnCode: record.hsnCode ?? "",
    gstRatePercent: text(record.gstRatePercent),
    images: toManaged(record.images),
    seoTitle: record.seoTitle ?? "",
    seoDescription: record.seoDescription ?? "",
  };
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
export function toPayload(draft: AdminProductDraft) {
  return {
    name: draft.name.trim(),
    ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
    sku: draft.sku.trim(),
    category: draft.categoryId,
    status: draft.status,
    featured: draft.featured,
    shortDescription: draft.shortDescription.trim(),
    description: draft.description.trim(),
    fabric: draft.fabric,
    weavingType: draft.weavingType,
    occasion: draft.occasion,
    design: draft.design,
    ...(draft.variants.length ? {} : { colors: draft.colors }),
    sareeLength: draft.sareeLength.trim(),
    blousePiece: draft.blousePiece.trim(),
    careInstructions: draft.careInstructions.trim(),
    price: Number(draft.price),
    compareAtPrice: toNumber(draft.compareAtPrice) ?? 0,
    wholesalePrice: Number(draft.wholesalePrice),
    minimumOrderQuantity: Number(draft.minimumOrderQuantity) || 1,
    stockQuantity: Number(draft.stockQuantity) || 0,
    bulkPricingTiers: draft.tiers
      .filter((tier) => tier.minQuantity && tier.pricePerUnit)
      .map((tier) => ({ minQuantity: Number(tier.minQuantity), pricePerUnit: Number(tier.pricePerUnit) })),
    variants: draft.variants.map((variant, index) => ({
      ...(variant._id ? { _id: variant._id } : {}),
      colorName: variant.colorName.trim(),
      colorHex: variant.colorHex,
      sku: variant.sku.trim(),
      stockQuantity: Number(variant.stockQuantity) || 0,
      images: toImagePayload(variant.images, `${draft.name} in ${variant.colorName}`),
      sortOrder: index,
    })),
    hsnCode: draft.hsnCode.trim(),
    gstRatePercent: draft.gstRatePercent.trim() === "" ? null : Number(draft.gstRatePercent),
    images: toImagePayload(draft.images, draft.name),
    seoTitle: draft.seoTitle.trim(),
    seoDescription: draft.seoDescription.trim(),
  };
}
