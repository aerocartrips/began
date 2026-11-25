/** Storefront catalog shapes. Amounts are rupees; all stores sell in INR. */

export type CatalogImage = { url: string; alt: string; publicId?: string };

/** One colour a product comes in (a card swatch). */
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
  /** Sizes on offer, e.g. "S–XXL" ("" without sizes). */
  sizeRange: string;
};

/** One purchasable combination of a product's options (Red / M). */
export type ProductVariantData = {
  id: string;
  /** "Red / M". */
  title: string;
  /** Option key → value, e.g. { color: "Red", size: "M" }. */
  options: Record<string, string>;
  colorName: string;
  colorHex: string;
  sku: string;
  barcode: string;
  stock: number;
  /** The colour's photos (shared by its sizes). */
  images: CatalogImage[];
};

/** How shoppers pick an option: colour swatches, size chips (with the size guide) or plain chips. */
export type ProductOptionKind = "color" | "size" | "choice";

/** One option a product's variants differ by, with the values it comes in (in display order). */
export type ProductOptionData = {
  key: string;
  name: string;
  kind: ProductOptionKind;
  /** What the option means to search engines ("color", "size", "material"…; "" for none). */
  schemaProperty: string;
  values: { value: string; hex?: string }[];
};

export type ProductSpec = { key: string; label: string; value: string };

export type SizeChartData = {
  /** The option the chart describes (usually "size"). */
  optionKey: string;
  unit: "in" | "cm";
  columns: { label: string; primary: boolean; measurement: boolean }[];
  rows: { size: string; values: string[] }[];
  note: string;
  howToMeasure: { label: string; text: string }[];
};

export type ProductTypeSummary = { id: string; name: string; pluralName: string; slug: string };

export type ProductDetailData = ProductCardData & {
  sku: string;
  /** HSN code for GST invoices; "" when not set. */
  hsnCode: string;
  /** The product's own GST rate (%); null uses the store's default. */
  gstRatePercent: number | null;
  shortDescription: string;
  description: string;
  category: { name: string; slug: string } | null;
  /** What the product is (Saree, T-shirt…); null before the catalogue upgrade. */
  type: ProductTypeSummary | null;
  images: CatalogImage[];
  options: ProductOptionData[];
  variants: ProductVariantData[];
  tiers: PriceTier[];
  /** Raw price fields, so the page can re-price tiers as the quantity changes. */
  pricing: { price: number; compareAtPrice: number; wholesalePrice: number; minimumOrderQuantity: number };
  stock: number;
  specs: ProductSpec[];
  /** Detail values search engines understand (material, pattern, gender…), by schema.org property. */
  schemaFacts: Record<string, string>;
  careInstructions: string;
  sizeChart: SizeChartData | null;
  seoTitle: string;
  seoDescription: string;
  ratingDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
};

export type CatalogFacet = { value: string; count: number; hex?: string };

/** One filter group: an attribute with the values the current matches have. */
export type CatalogFacetGroup = {
  key: string;
  name: string;
  input: string;
  values: CatalogFacet[];
};

export type CatalogSort = "relevance" | "newest" | "popular" | "price-asc" | "price-desc";

export type CatalogQuery = {
  q: string;
  category: string;
  /** Product type slug ("" for every type). */
  type: string;
  /** Selected filter values by attribute key, e.g. { fabric: ["Silk"], size: ["M", "L"] }. */
  filters: Record<string, string[]>;
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
  facets: CatalogFacetGroup[];
  /** On a product type's listing: listed products of that type per category id (null elsewhere). */
  categoryCounts?: Record<string, number> | null;
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
  /** The product type its products are (80% or more of them); null when it mixes types. */
  typeId: string | null;
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

/* ------------------------------------------------------------------ store catalogue config */

export type CatalogTypeConfig = {
  id: string;
  name: string;
  pluralName: string;
  slug: string;
  icon: string;
  description: string;
  fields: { key: string; required: boolean }[];
  options: { key: string; values: string[] }[];
  sizeChart: SizeChartData | null;
  /** The template it was made from ("saree", "t-shirt"…; "" for none). */
  template: string;
  /** Cover photo set in Admin → Product types; null uses its most popular product's photo. */
  coverImage: CatalogImage | null;
  /** Listed products of this type. */
  productCount: number;
};

/** A product type as the storefront shows it: shortcuts, the "Shop by type" cards and rows. */
export type TypeShowcase = {
  id: string;
  name: string;
  pluralName: string;
  slug: string;
  icon: string;
  description: string;
  productCount: number;
  /** Lowest per-piece price in the store's sales mode. */
  startingPrice: number;
  cover: CatalogImage | null;
  /** Its most popular products. */
  products: ProductCardData[];
};

export type CatalogAttributeConfig = {
  key: string;
  name: string;
  input: string;
  unit: string;
  filterable: boolean;
  visible: boolean;
  schemaProperty: string;
  values: { label: string; hex: string }[];
};

/** What a store sells (lib/catalog/catalog-config.js): its types on sale and its attribute library. */
export type CatalogConfig = {
  types: CatalogTypeConfig[];
  attributes: Record<string, CatalogAttributeConfig>;
  /** Listed products without a type (before the catalogue upgrade). */
  untypedCount: number;
};
