import { basePriceFor, compareAtPriceFor, minimumQuantityFor, priceTiersFor } from "@/lib/catalog/pricing";

/** Fields every storefront product query selects. */
export const CARD_FIELDS =
  "name slug images variants price compareAtPrice wholesalePrice minimumOrderQuantity stockQuantity ratingSummary";

export const DETAIL_FIELDS = `${CARD_FIELDS} sku shortDescription description category bulkPricingTiers fabric weavingType occasion design colors sareeLength blousePiece careInstructions seoTitle seoDescription`;

/**
 * @param {Record<string, any> | undefined} image
 * @param {string} fallbackAlt
 * @returns {import("@/features/catalog/types").CatalogImage | null}
 */
export function toCatalogImage(image, fallbackAlt) {
  if (!image) return null;
  const url = image.secureUrl || image.url;
  if (!url) return null;
  return { url, alt: image.alt || fallbackAlt, ...(image.publicId ? { publicId: image.publicId } : {}) };
}

function sortedImages(images = []) {
  return [...images].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.sortOrder - right.sortOrder);
}

/**
 * @param {Record<string, any>} doc lean Product
 * @param {"wholesale" | "retail"} salesMode
 * @returns {import("@/features/catalog/types").ProductCardData}
 */
export function toProductCard(doc, salesMode) {
  const variants = [...(doc.variants ?? [])].sort((left, right) => left.sortOrder - right.sortOrder);
  const coverSource = sortedImages(doc.images)[0] ?? sortedImages(variants[0]?.images)[0];
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    image: toCatalogImage(coverSource, doc.name),
    price: basePriceFor(doc, salesMode),
    compareAtPrice: compareAtPriceFor(doc, salesMode),
    minimumQuantity: minimumQuantityFor(doc, salesMode),
    inStock: (doc.stockQuantity ?? 0) > 0,
    rating: {
      average: doc.ratingSummary?.averageRating ?? 0,
      count: doc.ratingSummary?.totalReviews ?? 0,
    },
    swatches: variants.map((variant) => ({
      id: String(variant._id),
      name: variant.colorName,
      hex: variant.colorHex,
      inStock: variant.stockQuantity > 0,
    })),
  };
}

/**
 * @param {Record<string, any>} doc lean Product with populated category
 * @param {"wholesale" | "retail"} salesMode
 * @returns {import("@/features/catalog/types").ProductDetailData}
 */
export function toProductDetail(doc, salesMode) {
  const card = toProductCard(doc, salesMode);
  const specs = [
    ["Fabric", doc.fabric],
    ["Weave", doc.weavingType],
    ["Pattern", doc.design],
    ["Occasion", doc.occasion],
    ["Colours", doc.colors?.join(", ")],
    ["Saree length", doc.sareeLength],
    ["Blouse piece", doc.blousePiece],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => ({ label, value }));

  const distribution = doc.ratingSummary?.distribution ?? {};
  return {
    ...card,
    sku: doc.sku,
    shortDescription: doc.shortDescription ?? "",
    description: doc.description ?? "",
    category:
      doc.category && typeof doc.category === "object"
        ? { name: doc.category.name, slug: doc.category.slug }
        : null,
    images: sortedImages(doc.images).map((image) => toCatalogImage(image, doc.name)).filter(Boolean),
    variants: [...(doc.variants ?? [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((variant) => ({
        id: String(variant._id),
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        sku: variant.sku,
        stock: variant.stockQuantity,
        images: sortedImages(variant.images).map((image) => toCatalogImage(image, `${doc.name} in ${variant.colorName}`)).filter(Boolean),
      })),
    tiers: priceTiersFor(doc, salesMode),
    pricing: {
      price: doc.price,
      compareAtPrice: doc.compareAtPrice ?? 0,
      wholesalePrice: doc.wholesalePrice,
      minimumOrderQuantity: doc.minimumOrderQuantity ?? 1,
    },
    stock: doc.stockQuantity ?? 0,
    specs,
    careInstructions: doc.careInstructions ?? "",
    seoTitle: doc.seoTitle || doc.name,
    seoDescription: doc.seoDescription || doc.shortDescription || "",
    ratingDistribution: {
      1: distribution[1] ?? 0,
      2: distribution[2] ?? 0,
      3: distribution[3] ?? 0,
      4: distribution[4] ?? 0,
      5: distribution[5] ?? 0,
    },
  };
}
