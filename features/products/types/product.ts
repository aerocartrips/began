export type ProductOption = {
  id: string;
  label: string;
  required?: boolean;
  values: readonly {
    id: string;
    label: string;
    available?: boolean;
  }[];
};

export type ProductImage = {
  src: string;
  alt: string;
  publicId?: string;
  secureUrl?: string;
};

export type Product = {
  id: string;
  slug: string;
  sku: string;
  title: string;
  details: string;
  description: string;
  category: string;
  currency: "USD";
  priceCents: number;
  compareAtPriceCents?: number;
  minimumOrderQuantity: number;
  inventory: number;
  status: "draft" | "published";
  featured: boolean;
  ratingAverage?: number;
  ratingCount?: number;
  seoTitle: string;
  seoDescription: string;
  saree: {
    fabric: string;
    weave: string;
    color: string;
    embellishment: string;
    occasion: string;
    lengthMeters: number;
    blousePiece: boolean;
    washCare: string;
  };
  images: readonly ProductImage[];
  shippingDetails: string;
  options: readonly ProductOption[];
};