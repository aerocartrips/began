import type { CatalogQuery } from "@/features/catalog/types";

type QueryChanges = Partial<Omit<CatalogQuery, "category">>;

const LIST_KEYS = ["fabric", "weave", "occasion", "color"] as const;

/**
 * URL for a catalog page with `changes` applied. Any filter change resets to
 * page 1; the category is part of the path for /categories/[slug].
 */
export function catalogHref(basePath: string, query: CatalogQuery, changes: QueryChanges = {}) {
  const next = { ...query, ...changes };
  if (!("page" in changes)) next.page = 1;
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category && !basePath.startsWith("/categories/")) params.set("category", next.category);
  for (const key of LIST_KEYS) for (const value of next[key]) params.append(key, value);
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
export function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

export function hasActiveFilters(query: CatalogQuery) {
  return Boolean(
    query.q ||
      LIST_KEYS.some((key) => query[key].length) ||
      query.minPrice !== null ||
      query.maxPrice !== null ||
      query.inStock,
  );
}
