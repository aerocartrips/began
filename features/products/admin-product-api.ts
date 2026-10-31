import type { Product, ProductImage } from "@/features/products/types/product";

type MongoCategory = { _id?: string; name?: string; slug?: string } | string;

export type MongoProductRecord = {
  _id: string;
  slug: string;
  sku: string;
  name: string;
  description?: string;
  shortDescription?: string;
  category?: MongoCategory;
  images?: {
    url?: string;
    secureUrl?: string;
    alt?: string;
    publicId?: string;
    isPrimary?: boolean;
  }[];
  fabric?: string;
  weavingType?: string;
  sareeLength?: string;
  blousePiece?: string;
  colors?: string[];
  design?: string;
  occasion?: string;
  price?: number;
  compareAtPrice?: number;
  wholesalePrice?: number;
  minimumOrderQuantity?: number;
  stockQuantity?: number;
  status?: string;
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

function categoryLabel(category: MongoCategory | undefined) {
  if (!category) return "Uncategorized";
  if (typeof category === "string") return category;
  return category.name ?? "Uncategorized";
}

function parseLengthMeters(value?: string) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6.3;
}

function extractShippingDetails(description: string) {
  const marker = "\n\nShipping:";
  const index = description.indexOf(marker);
  if (index < 0) {
    return { body: description, shippingDetails: "Standard wholesale dispatch." };
  }
  return {
    body: description.slice(0, index).trim(),
    shippingDetails: description.slice(index + marker.length).trim() || "Standard wholesale dispatch.",
  };
}

export function mapMongoProductToAdminForm(doc: MongoProductRecord): Product {
  const { body, shippingDetails } = extractShippingDetails(doc.description ?? "");
  const unitPrice = doc.wholesalePrice ?? doc.price ?? 0;
  const images: ProductImage[] = (doc.images?.length ? doc.images : [{ url: "", alt: doc.name }]).map(
    (image) => ({
      src: image.secureUrl || image.url || "",
      secureUrl: image.secureUrl || image.url,
      publicId: image.publicId,
      alt: image.alt || doc.name,
    }),
  );

  return {
    id: String(doc._id),
    slug: doc.slug,
    sku: doc.sku,
    title: doc.name,
    details: doc.shortDescription || doc.weavingType || "",
    description: body,
    category: categoryLabel(doc.category),
    currency: "USD",
    priceCents: Math.round(unitPrice * 100),
    compareAtPriceCents: doc.compareAtPrice ? Math.round(doc.compareAtPrice * 100) : undefined,
    minimumOrderQuantity: doc.minimumOrderQuantity ?? 1,
    inventory: doc.stockQuantity ?? 0,
    status: doc.status === "active" ? "published" : "draft",
    featured: Boolean(doc.featured),
    seoTitle: doc.seoTitle || doc.name,
    seoDescription: doc.seoDescription || body.slice(0, 160),
    saree: {
      fabric: doc.fabric || "",
      weave: doc.weavingType || "",
      color: doc.colors?.[0] || "",
      embellishment: doc.design || "",
      occasion: doc.occasion || "",
      lengthMeters: parseLengthMeters(doc.sareeLength),
      blousePiece: /included|yes|true/i.test(doc.blousePiece ?? ""),
      washCare: "",
    },
    images,
    shippingDetails,
    options: [],
  };
}

export function buildProductApiPayload(product: Product) {
  const price = product.priceCents / 100;
  const compareAtPrice = product.compareAtPriceCents
    ? product.compareAtPriceCents / 100
    : undefined;

  const shippingNote = product.shippingDetails?.trim()
    ? `\n\nShipping: ${product.shippingDetails.trim()}`
    : "";

  return {
    name: product.title,
    sku: product.sku,
    description: `${product.description}${shippingNote}`.trim(),
    shortDescription: product.details || product.description.slice(0, 400),
    category: product.category,
    images: product.images.map((image, index) => ({
      url: image.secureUrl || image.src,
      alt: image.alt || product.title,
      isPrimary: index === 0,
      sortOrder: index,
      publicId: image.publicId,
    })),
    fabric: product.saree.fabric,
    weavingType: product.saree.weave,
    sareeLength: `${product.saree.lengthMeters} m`,
    blousePiece: product.saree.blousePiece ? "Blouse piece included" : "Blouse piece not included",
    colors: product.saree.color ? [product.saree.color] : [],
    design: product.saree.embellishment,
    occasion: product.saree.occasion,
    price,
    compareAtPrice,
    wholesalePrice: price,
    minimumOrderQuantity: product.minimumOrderQuantity,
    stockQuantity: product.inventory,
    status: product.status === "published" ? "active" : "draft",
    featured: product.featured,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
  };
}

export function productImagesArePersistable(images: readonly ProductImage[]) {
  return images.every((image) => /^https?:\/\//i.test(image.secureUrl || image.src));
}
