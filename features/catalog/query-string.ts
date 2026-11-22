import type { CatalogQuery } from "@/features/catalog/types";

type QueryChanges = Partial<Omit<CatalogQuery, "category" | "filters">> & {
  /** Filter selections to replace, by attribute key ([] clears one). */
  filters?: Record<string, string[]>;
};

/**
 * URL for a catalog page with `changes` applied. Any filter change resets to
 * page 1; the category is part of the path for /categories/[slug], and the
 * product type for /shop/[type]. Filters are written in key order, so one
 * selection always has one URL.
 */
export function catalogHref(basePath: string, query: CatalogQuery, changes: QueryChanges = {}) {
  const { filters: filterChanges, ...rest } = changes;
  const next = { ...query, ...rest, filters: { ...query.filters, ...filterChanges } };
  if (!("page" in changes)) next.page = 1;
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category && !basePath.startsWith("/categories/")) params.set("category", next.category);
  if (next.type && !basePath.startsWith("/shop/")) params.set("type", next.type);
  for (const key of Object.keys(next.filters).sort()) for (const value of next.filters[key] ?? []) params.append(key, value);
  if (next.minPrice !== null) params.set("min", String(next.minPrice));
  if (next.maxPrice !== null) params.set("max", String(next.maxPrice));
  if (next.inStock) params.set("stock", "1");
  const defaultSort = next.q ? "relevance" : "newest";
  if (next.sort !== defaultSort) params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

/** Toggles one value of a multi-select filter. */
export function toggleValue(values: string[] | undefined, value: string) {
  const list = values ?? [];
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

/** Selected filter values across every group. */
export function filterCount(query: CatalogQuery) {
  return Object.values(query.filters).reduce((total, values) => total + values.length, 0);
}

export function hasActiveFilters(query: CatalogQuery) {
  return Boolean(query.q || filterCount(query) || query.minPrice !== null || query.maxPrice !== null || query.inStock);
}
