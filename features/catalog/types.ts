/** Storefront catalog shapes. Amounts are rupees; all stores sell in INR. */

export type CatalogImage = { url: string; alt: string; publicId?: string };

export type Swatch = { id: string; name: string; hex: string; inStock: boolean };

export type PriceTier = { minQuantity: number; pricePerUnit: number };

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  image: CatalogImage | null;
  /** Per-piece price for the store's sales mode (wholesale or retail). */
  price: number;
  /** Retail "was" price, when discounted. */
  compareAtPrice: number | null;
  /** Retail discount against the "was" price, rounded. */
  discountPercent: number | null;
  /** Wholesale: the lowest quantity-tier price below the base price. */
  bestTier: PriceTier | null;
  /** Minimum pieces per order (1 for retail stores). */
  minimumQuantity: number;
  inStock: boolean;
  /** Added to the catalogue recently. */
  isNew: boolean;
  rating: { average: number; count: number };
  swatches: Swatch[];
};

export type ProductVariantData = {
  id: string;
  colorName: string;
  colorHex: string;
  sku: string;
  stock: number;
  images: CatalogImage[];
};

export type ProductSpec = { label: string; value: string };

export type ProductDetailData = ProductCardData & {
  sku: string;
  shortDescription: string;
  description: string;
  category: { name: string; slug: string } | null;
  images: CatalogImage[];
  variants: ProductVariantData[];
  tiers: PriceTier[];
  /** Raw price fields, so the page can re-price tiers as the quantity changes. */
  pricing: { price: number; compareAtPrice: number; wholesalePrice: number; minimumOrderQuantity: number };
  stock: number;
  specs: ProductSpec[];
  careInstructions: string;
  seoTitle: string;
  seoDescription: string;
  ratingDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
};

export type CatalogFacetKey = "fabric" | "weave" | "occasion" | "color";

export type CatalogFacet = { value: string; count: number; hex?: string };

export type CatalogSort = "relevance" | "newest" | "popular" | "price-asc" | "price-desc";

export type CatalogQuery = {
  q: string;
  category: string;
  fabric: string[];
  weave: string[];
  occasion: string[];
  color: string[];
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  sort: CatalogSort;
  page: number;
};

export type CatalogResult = {
  items: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
  /** Lowest and highest piece price among the current matches (the price filter's placeholders). */
  priceRange: { min: number; max: number } | null;
  facets: Record<CatalogFacetKey, CatalogFacet[]>;
};

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  /** Parent category, or null for a top-level one. */
  parentId: string | null;
  /** Active products directly in this category (subcategories not included; see subtreeTotals). */
  productCount: number;
  /** Latest change to the category or one of its products (ISO), for sitemaps. */
  lastModified: string | null;
};

/** A top-level category on the home page "catalogue at a glance". */
export type CategoryOverview = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  /** Active products, including those in subcategories. */
  productCount: number;
  /** Lowest per-piece price in the store's sales mode. */
  startingPrice: number;
  previews: CatalogImage[];
};

export type FeedPage = { items: ProductCardData[]; nextCursor: string | null };

/** A home page row's products, and how many its "View all" page lists. */
export type ProductList = { items: ProductCardData[]; total: number };

export type QuickPickLink = { label: string; href: string; count?: number };

export type QuickPickGroup = { key: string; title: string; links: QuickPickLink[] };

export type HomeReview = {
  id: string;
  rating: number;
  title: string;
  comment: string;
  authorName: string;
  createdAt: string;
  product: { name: string; slug: string };
};

export type Recommendations = {
  personalized: boolean;
  /** Why these products were picked, e.g. "Based on your interest in Banarasi". */
  reason: string;
  items: ProductCardData[];
};

export type ProductSuggestion = {
  slug: string;
  name: string;
  imageUrl: string;
  price: number;
};
