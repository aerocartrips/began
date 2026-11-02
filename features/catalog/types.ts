/** Storefront catalog shapes. Amounts are rupees; all stores sell in INR. */

export type CatalogImage = { url: string; alt: string; publicId?: string };

export type Swatch = { id: string; name: string; hex: string; inStock: boolean };

export type PriceTier = { minQuantity: number; pricePerUnit: number };

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  image: CatalogImage | null;
  /** Per-piece price for the store's sales mode (wholesale or retail). */
  price: number;
  /** Retail "was" price, when discounted. */
  compareAtPrice: number | null;
  /** Minimum pieces per order (1 for retail stores). */
  minimumQuantity: number;
  inStock: boolean;
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
  facets: Record<CatalogFacetKey, CatalogFacet[]>;
};

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  productCount: number;
};

export type ProductSuggestion = {
  slug: string;
  name: string;
  imageUrl: string;
  price: number;
};
