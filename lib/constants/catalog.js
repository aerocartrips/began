/** Attribute lists a store manages (Admin → Attributes). */
export const ATTRIBUTE_TYPES = {
  FABRIC: "fabric",
  WEAVE: "weave",
  OCCASION: "occasion",
  PATTERN: "pattern",
  COLOR: "color",
};

export const ATTRIBUTE_TYPE_VALUES = Object.values(ATTRIBUTE_TYPES);

export const ATTRIBUTE_TYPE_LABELS = {
  [ATTRIBUTE_TYPES.FABRIC]: "Fabric",
  [ATTRIBUTE_TYPES.WEAVE]: "Weave",
  [ATTRIBUTE_TYPES.OCCASION]: "Occasion",
  [ATTRIBUTE_TYPES.PATTERN]: "Pattern",
  [ATTRIBUTE_TYPES.COLOR]: "Colour",
};

/** Product field holding each attribute type's value. */
export const ATTRIBUTE_PRODUCT_FIELD = {
  [ATTRIBUTE_TYPES.FABRIC]: "fabric",
  [ATTRIBUTE_TYPES.WEAVE]: "weavingType",
  [ATTRIBUTE_TYPES.OCCASION]: "occasion",
  [ATTRIBUTE_TYPES.PATTERN]: "design",
  [ATTRIBUTE_TYPES.COLOR]: "colors",
};

export const CATALOG_SORTS = {
  NEWEST: "newest",
  PRICE_ASC: "price-asc",
  PRICE_DESC: "price-desc",
  POPULAR: "popular",
  RELEVANCE: "relevance",
};

export const CATALOG_SORT_LABELS = {
  [CATALOG_SORTS.RELEVANCE]: "Best match",
  [CATALOG_SORTS.NEWEST]: "Newest",
  [CATALOG_SORTS.POPULAR]: "Most popular",
  [CATALOG_SORTS.PRICE_ASC]: "Price: low to high",
  [CATALOG_SORTS.PRICE_DESC]: "Price: high to low",
};

export const CATALOG_PAGE_SIZE = 24;
/** Deepest page served; beyond this, shoppers should refine filters. */
export const CATALOG_MAX_PAGE = 200;
