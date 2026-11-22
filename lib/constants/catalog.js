/**
 * Catalogue building blocks. A store describes what it sells with:
 *
 * - Attributes (Admin → Attributes): reusable fields such as Fabric, Colour,
 *   Size or Fit, each with an input kind and, for list inputs, its values.
 * - Product types (Admin → Product types): Saree, T-shirt, Jeans… Each picks
 *   the attributes its products describe (product details) and the ones
 *   shoppers choose between (options, e.g. Colour × Size, one SKU and stock
 *   figure per combination), plus a size chart and defaults. A type the store
 *   is not selling is hidden from the storefront with all of its products.
 */

/** How an attribute's value is entered in Admin. */
export const ATTRIBUTE_INPUTS = {
  /** One value from the attribute's list. */
  SELECT: "select",
  /** Several values from the attribute's list. */
  MULTISELECT: "multiselect",
  /** One named colour from the list, each with a swatch. */
  COLOR: "color",
  /** Free text. */
  TEXT: "text",
  /** A number, shown with the attribute's unit. */
  NUMBER: "number",
  /** Yes or no. */
  BOOLEAN: "boolean",
};

export const ATTRIBUTE_INPUT_VALUES = Object.values(ATTRIBUTE_INPUTS);

export const ATTRIBUTE_INPUT_LABELS = {
  [ATTRIBUTE_INPUTS.SELECT]: "Pick one from a list",
  [ATTRIBUTE_INPUTS.MULTISELECT]: "Pick several from a list",
  [ATTRIBUTE_INPUTS.COLOR]: "Colour with swatch",
  [ATTRIBUTE_INPUTS.TEXT]: "Text",
  [ATTRIBUTE_INPUTS.NUMBER]: "Number",
  [ATTRIBUTE_INPUTS.BOOLEAN]: "Yes / no",
};

/** Inputs whose values come from the attribute's own list. */
export const LISTED_INPUTS = [ATTRIBUTE_INPUTS.SELECT, ATTRIBUTE_INPUTS.MULTISELECT, ATTRIBUTE_INPUTS.COLOR];

/** Inputs an option (what shoppers choose, such as colour or size) can use: exactly one value per variant. */
export const OPTION_INPUTS = [ATTRIBUTE_INPUTS.SELECT, ATTRIBUTE_INPUTS.COLOR];

/** Inputs that can become storefront filters (free text and numbers make poor filters). */
export const FILTERABLE_INPUTS = [ATTRIBUTE_INPUTS.SELECT, ATTRIBUTE_INPUTS.MULTISELECT, ATTRIBUTE_INPUTS.COLOR, ATTRIBUTE_INPUTS.BOOLEAN];

/** Stored values of a yes/no attribute. */
export const BOOLEAN_VALUES = { YES: "Yes", NO: "No" };

/**
 * schema.org properties an attribute can stand for in the structured data
 * search engines read (Google merchant listings and product variants).
 */
export const SCHEMA_PROPERTIES = {
  NONE: "",
  MATERIAL: "material",
  PATTERN: "pattern",
  COLOR: "color",
  SIZE: "size",
  GENDER: "suggestedGender",
  AGE_GROUP: "suggestedAge",
};

export const SCHEMA_PROPERTY_VALUES = Object.values(SCHEMA_PROPERTIES);

export const SCHEMA_PROPERTY_LABELS = {
  [SCHEMA_PROPERTIES.NONE]: "Not used",
  [SCHEMA_PROPERTIES.MATERIAL]: "Material",
  [SCHEMA_PROPERTIES.PATTERN]: "Pattern",
  [SCHEMA_PROPERTIES.COLOR]: "Colour",
  [SCHEMA_PROPERTIES.SIZE]: "Size",
  [SCHEMA_PROPERTIES.GENDER]: "Gender",
  [SCHEMA_PROPERTIES.AGE_GROUP]: "Age group",
};

/**
 * Attribute keys become catalogue URL parameters (`/products?fabric=Silk`),
 * so they can't take the names the catalogue and product pages already use.
 */
export const RESERVED_ATTRIBUTE_KEYS = [
  "q",
  "category",
  "type",
  "min",
  "max",
  "stock",
  "sort",
  "page",
  "variant",
  "sku",
  "quantity",
  "product",
  "from",
  "intent",
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
];

/** Lower-case letters, digits and underscores, starting with a letter. */
export const ATTRIBUTE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

export const MAX_ATTRIBUTE_VALUES = 300;
export const MAX_TYPE_FIELDS = 30;
/** Options per product type (Shopify allows three too: colour × size × one more is plenty). */
export const MAX_TYPE_OPTIONS = 3;
export const MAX_PRODUCT_VARIANTS = 100;
export const MAX_SIZE_CHART_COLUMNS = 8;
export const MAX_SIZE_CHART_ROWS = 40;

/** Icons a product type can show with (lucide-react names, mapped in components/catalog/product-type-icon.tsx). */
export const PRODUCT_TYPE_ICONS = [
  "shirt",
  "sparkles",
  "layers",
  "crown",
  "flower",
  "footprints",
  "baby",
  "shopping-bag",
  "gem",
  "watch",
  "glasses",
  "bed-double",
  "spool",
  "gift",
  "package",
];

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
/** Values listed per filter group (most common first). */
export const CATALOG_FACET_LIMIT = 40;
/** Filter values a shopper can pick per group, and filter groups per request. */
export const CATALOG_MAX_FILTER_VALUES = 12;
export const CATALOG_MAX_FILTER_KEYS = 16;
