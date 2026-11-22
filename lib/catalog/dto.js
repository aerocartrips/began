import { basePriceFor, compareAtPriceFor, minimumQuantityFor, priceTiersFor } from "@/lib/catalog/pricing";
import { ATTRIBUTE_INPUTS, SCHEMA_PROPERTIES } from "@/lib/constants/catalog";
import { formatAttributeValues, valuesOf } from "@/lib/catalog/attribute-values";
import { optionsOf, variantTitleOf } from "@/lib/catalog/variants";
import { colorKeyOf, sizeKeyOf, toSizeChart, typeById, valueOrderOf } from "@/lib/catalog/catalog-config";

/** Fields every storefront product query selects. */
export const CARD_FIELDS =
  "name slug sku images variants colorMedia sizeRange price compareAtPrice wholesalePrice bulkPricingTiers minimumOrderQuantity stockQuantity ratingSummary createdAt";

/** Products added within this many days carry a "New" badge. */
const NEW_PRODUCT_DAYS = 21;

export const DETAIL_FIELDS = `${CARD_FIELDS} shortDescription description category productType attributes colors careInstructions sizeChart seoTitle seoDescription`;

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
  return [...images].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
}

const byPosition = (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0);

/**
 * A colour's photos, best first: the product's photo group for that colour,
 * else (products saved before the catalogue upgrade) the variant's own photos
 * or those of another variant in the same colour.
 * @param {Record<string, any>} doc lean Product
 * @param {string} colorName
 * @param {Record<string, any> | null} [variant]
 */
export function colourPhotos(doc, colorName, variant = null) {
  if (colorName) {
    const media = doc.colorMedia?.find((entry) => entry.color === colorName);
    if (media?.images?.length) return sortedImages(media.images);
  }
  if (variant?.images?.length) return sortedImages(variant.images);
  if (colorName) {
    const sibling = doc.variants?.find((entry) => entry.colorName === colorName && entry.images?.length);
    if (sibling) return sortedImages(sibling.images);
  }
  return [];
}

/** The first photo of the first colour that has any. */
function firstColourPhoto(doc, variants) {
  for (const variant of variants) {
    const [photo] = colourPhotos(doc, variant.colorName, variant);
    if (photo) return photo;
  }
  return null;
}

/**
 * The product's colours for its card: one swatch per colour (not per size),
 * in stock when any variant in that colour is.
 * @param {Record<string, any>[]} variants sorted
 */
function swatchesOf(variants) {
  const byColour = new Map();
  for (const variant of variants) {
    if (!variant.colorName) continue;
    const swatch = byColour.get(variant.colorName);
    if (swatch) swatch.inStock ||= variant.stockQuantity > 0;
    else byColour.set(variant.colorName, { id: String(variant._id), name: variant.colorName, hex: variant.colorHex, inStock: variant.stockQuantity > 0 });
  }
  return [...byColour.values()];
}

/**
 * @param {Record<string, any>} doc lean Product
 * @param {"wholesale" | "retail"} salesMode
 * @returns {import("@/features/catalog/types").ProductCardData}
 */
export function toProductCard(doc, salesMode) {
  const variants = [...(doc.variants ?? [])].sort(byPosition);
  const coverSource = sortedImages(doc.images)[0] ?? firstColourPhoto(doc, variants);
  const price = basePriceFor(doc, salesMode);
  const compareAtPrice = compareAtPriceFor(doc, salesMode);
  // Lowest per-piece price on offer, so wholesale buyers see the volume saving on the card.
  const bestTier = priceTiersFor(doc, salesMode).filter((tier) => tier.pricePerUnit < price).at(-1) ?? null;
  const createdAt = doc.createdAt ? new Date(doc.createdAt).getTime() : 0;
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    sku: doc.sku ?? "",
    image: toCatalogImage(coverSource, doc.name),
    price,
    compareAtPrice,
    discountPercent: compareAtPrice ? Math.round((1 - price / compareAtPrice) * 100) || null : null,
    bestTier: bestTier ? { minQuantity: bestTier.minQuantity, pricePerUnit: bestTier.pricePerUnit } : null,
    minimumQuantity: minimumQuantityFor(doc, salesMode),
    inStock: (doc.stockQuantity ?? 0) > 0,
    isNew: createdAt > 0 && Date.now() - createdAt < NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000,
    rating: {
      average: doc.ratingSummary?.averageRating ?? 0,
      count: doc.ratingSummary?.totalReviews ?? 0,
    },
    swatches: swatchesOf(variants),
    sizeRange: doc.sizeRange ?? "",
  };
}

/**
 * The options a product's variants differ by, in its type's order, each with
 * the values the product actually has (in the type's value order). Options
 * no variant uses are left out; products without a type fall back to colour.
 * @param {Record<string, any>[]} variants sorted
 * @param {import("@/features/catalog/types").CatalogTypeConfig | null} type
 * @param {import("@/features/catalog/types").CatalogConfig} config
 * @param {string | null} sizeKey
 * @returns {import("@/features/catalog/types").ProductOptionData[]}
 */
function optionsFor(variants, type, config, sizeKey) {
  const present = new Map();
  for (const variant of variants) {
    for (const [key, value] of Object.entries(optionsOf(variant))) {
      if (!present.has(key)) present.set(key, new Set());
      present.get(key).add(value);
    }
  }
  if (!present.size && variants.some((variant) => variant.colorName)) {
    present.set("color", new Set(variants.map((variant) => variant.colorName).filter(Boolean)));
  }
  const keys = [...(type?.options.map((option) => option.key) ?? []), ...present.keys()].filter((key, index, all) => all.indexOf(key) === index);

  return keys
    .filter((key) => present.get(key)?.size)
    .map((key) => {
      const attribute = config.attributes[key];
      const order = valueOrderOf(config, type, key);
      const values = [...present.get(key)].sort((left, right) => rank(order, left) - rank(order, right));
      const isColour = attribute?.input === ATTRIBUTE_INPUTS.COLOR || (!attribute && key === "color");
      const hexOf = (value) =>
        variants.find((variant) => (optionsOf(variant)[key] ?? variant.colorName) === value)?.colorHex ||
        attribute?.values.find((entry) => entry.label === value)?.hex ||
        "";
      const kind = isColour ? "color" : key === sizeKey ? "size" : "choice";
      return {
        key,
        name: attribute?.name ?? (key === "color" ? "Colour" : key),
        kind,
        schemaProperty: attribute?.schemaProperty || (kind === "color" ? SCHEMA_PROPERTIES.COLOR : kind === "size" ? SCHEMA_PROPERTIES.SIZE : ""),
        values: values.map((value) => (isColour ? { value, hex: hexOf(value) } : { value })),
      };
    });
}

const rank = (order, value) => {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
};

/**
 * Detail values as the product page lists them (visible attributes of the
 * type, in its order), and the ones search engines understand by property.
 * @param {Record<string, any>} doc
 * @param {import("@/features/catalog/types").CatalogTypeConfig | null} type
 * @param {import("@/features/catalog/types").CatalogConfig} config
 */
function specsFor(doc, type, config) {
  const specs = [];
  /** @type {Record<string, string>} */
  const schemaFacts = {};
  for (const field of type?.fields ?? []) {
    const attribute = config.attributes[field.key];
    if (!attribute) continue;
    const values = valuesOf(doc.attributes, field.key);
    const value = formatAttributeValues(attribute, values);
    if (!value) continue;
    if (attribute.visible) specs.push({ key: field.key, label: attribute.name, value });
    if (attribute.schemaProperty && attribute.schemaProperty !== SCHEMA_PROPERTIES.SIZE && !schemaFacts[attribute.schemaProperty]) {
      schemaFacts[attribute.schemaProperty] = values[0];
    }
  }
  return { specs, schemaFacts };
}

/**
 * @param {Record<string, any>} doc lean Product with populated category
 * @param {"wholesale" | "retail"} salesMode
 * @param {import("@/features/catalog/types").CatalogConfig} config the store's catalogue (lib/catalog/catalog-config.js)
 * @returns {import("@/features/catalog/types").ProductDetailData}
 */
export function toProductDetail(doc, salesMode, config) {
  const card = toProductCard(doc, salesMode);
  const type = typeById(config, doc.productType);
  const variants = [...(doc.variants ?? [])].sort(byPosition);
  const sizeChart = toSizeChart(doc.sizeChart) ?? type?.sizeChart ?? null;
  const sizeKey = sizeKeyOf(type, config.attributes, sizeChart);
  const colorKey = colorKeyOf(type, config.attributes);
  const { specs, schemaFacts } = specsFor(doc, type, config);
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
    type: type ? { id: type.id, name: type.name, pluralName: type.pluralName, slug: type.slug } : null,
    images: sortedImages(doc.images).map((image) => toCatalogImage(image, doc.name)).filter(Boolean),
    options: optionsFor(variants, type, config, sizeKey),
    variants: variants.map((variant) => {
      const options = optionsOf(variant);
      const colorName = variant.colorName || (colorKey ? options[colorKey] ?? "" : "");
      const title = variant.title || variantTitleOf(options, colorName);
      return {
        id: String(variant._id),
        title,
        options: Object.keys(options).length ? options : colorName ? { color: colorName } : {},
        colorName,
        colorHex: variant.colorHex,
        sku: variant.sku,
        barcode: variant.barcode ?? "",
        stock: variant.stockQuantity,
        images: colourPhotos(doc, colorName, variant).map((image) => toCatalogImage(image, `${doc.name} in ${colorName || title}`)).filter(Boolean),
      };
    }),
    tiers: priceTiersFor(doc, salesMode),
    pricing: {
      price: doc.price,
      compareAtPrice: doc.compareAtPrice ?? 0,
      wholesalePrice: doc.wholesalePrice,
      minimumOrderQuantity: doc.minimumOrderQuantity ?? 1,
    },
    stock: doc.stockQuantity ?? 0,
    specs,
    schemaFacts,
    careInstructions: doc.careInstructions ?? "",
    sizeChart: sizeChart && sizeKey ? { ...sizeChart, optionKey: sizeKey } : sizeChart,
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
