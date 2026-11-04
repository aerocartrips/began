/** Home page layout, as stored per store and edited in Admin → Home page. */

export type HomeSectionType =
  | "category-nav"
  | "hero"
  | "trust"
  | "for-you"
  | "catalogue"
  | "product-tabs"
  | "quick-picks"
  | "collection"
  | "recently-viewed"
  | "reviews"
  | "cta"
  | "guides"
  | "newsletter"
  | "feed";

export type ProductTabKey = "bestsellers" | "new" | "trending";

export type CollectionSource = {
  kind: "category" | "products" | "fabric" | "weave" | "occasion";
  /** Category slug or attribute value; unused for hand-picked products. */
  value: string;
  productIds: string[];
  sort: "popular" | "newest" | "price-asc";
};

export type TrustItem = { icon: string; title: string; text: string };

export type HomeLink = { label: string; href: string };

export type HomeSection = {
  key: string;
  type: HomeSectionType;
  enabled: boolean;
  title: string;
  description: string;
  limit: number;
  viewAllHref: string;
  showOnMobile: boolean;
  showOnDesktop: boolean;
  source?: CollectionSource;
  tabs?: ProductTabKey[];
  items?: TrustItem[];
  primaryCta?: HomeLink;
  secondaryCta?: HomeLink;
};

export type AdminHomepageLayout = {
  sections: HomeSection[];
  /** True until the store saves its own layout. */
  isDefault: boolean;
  updatedAt: string | null;
};
