import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { mapMongoImageToStorefront } from "@/lib/catalog/map-product-image";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "USD";

/**
 * @param {number} majorUnits
 */
export function majorUnitsToCents(majorUnits) {
  return Math.round(Number(majorUnits) * 100);
}

/**
 * Maps a MongoDB product document into the storefront Product shape.
 * @param {Record<string, any>} doc
 */
export function mapMongoProductToStorefront(doc) {
  const categoryName =
    typeof doc.category === "object" && doc.category?.name ? doc.category.name : "Wholesale";

  const images = (doc.images?.length ? doc.images : [{ url: "", alt: doc.name }]).map(
    (image, index) => mapMongoImageToStorefront(image, index, doc.name),
  );

  const fabric = doc.fabric || "Handloom silk";
  const weave = doc.weavingType || "Handloom";
  const color = Array.isArray(doc.colors) && doc.colors.length > 0 ? doc.colors.join(", ") : "Assorted";
  const wholesaleMajor = doc.wholesalePrice ?? doc.price ?? 0;

  return {
    id: String(doc._id),
    slug: doc.slug,
    sku: doc.sku,
    title: doc.name,
    details: doc.shortDescription || `${weave} · ${fabric}`,
    description: doc.description || doc.shortDescription || "",
    category: categoryName,
    currency: DEFAULT_CURRENCY,
    priceCents: majorUnitsToCents(wholesaleMajor),
    compareAtPriceCents: doc.compareAtPrice
      ? majorUnitsToCents(doc.compareAtPrice)
      : doc.price
        ? majorUnitsToCents(doc.price)
        : undefined,
    minimumOrderQuantity: doc.minimumOrderQuantity ?? 1,
    inventory: doc.stockQuantity ?? 0,
    status: doc.status === PRODUCT_STATUS.ACTIVE ? "published" : "draft",
    featured: Boolean(doc.featured),
    ratingAverage: Number(doc.ratingSummary?.averageRating ?? 0),
    ratingCount: Number(doc.ratingSummary?.totalReviews ?? 0),
    seoTitle: doc.seoTitle || doc.name,
    seoDescription: doc.seoDescription || doc.shortDescription || "",
    saree: {
      fabric,
      weave,
      color,
      embellishment: doc.design || "Handcrafted",
      occasion: doc.occasion || "Wholesale",
      lengthMeters: Number.parseFloat(doc.sareeLength) || 6.3,
      blousePiece: doc.blousePiece !== "false" && doc.blousePiece !== false,
      washCare: "Dry clean only",
    },
    images,
    shippingDetails:
      doc.shippingDetails ||
      "Export-ready batch. Shipping terms are confirmed with the supplier.",
    options: [],
    _source: "database",
  };
}

/**
 * @param {Record<string, any>} product
 */
export function mapStaticProductToStorefront(product) {
  return {
    ...product,
    images: product.images.map((image) => ({ ...image })),
    options: product.options.map((option) => ({
      ...option,
      values: option.values.map((value) => ({ ...value })),
    })),
    saree: { ...product.saree },
    _source: "static",
  };
}

/**
 * @param {unknown[]} products
 */
export function stripInternalCatalogFields(products) {
  return products.map(({ _source, ...product }) => product);
}
