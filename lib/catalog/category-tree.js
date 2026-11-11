/**
 * Category hierarchy helpers over getCategories() results. A category page
 * lists its subcategories' products too (categoryIdsFor), so counts, update
 * times and breadcrumb trails follow the tree.
 * @typedef {import("@/features/catalog/types").CategorySummary} CategorySummary
 */

/** Deep enough for any real catalogue; stops a corrupt parent cycle from looping. */
const MAX_DEPTH = 10;

/**
 * The category with this slug and its ancestors, root first (breadcrumbs).
 * @param {CategorySummary[]} categories
 * @param {string} slug
 * @returns {CategorySummary[]}
 */
export function categoryTrail(categories, slug) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const trail = [];
  let current = categories.find((category) => category.slug === slug);
  while (current && trail.length < MAX_DEPTH && !trail.includes(current)) {
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail;
}

/**
 * Products and latest update per category, its subcategories included.
 * @param {CategorySummary[]} categories
 * @returns {Map<string, { productCount: number, lastModified: string | null }>} by category id
 */
export function subtreeTotals(categories) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const totals = new Map(categories.map((category) => [category.id, { productCount: 0, lastModified: null }]));
  for (const category of categories) {
    // Add this category's own products to it and to every ancestor.
    let current = category;
    for (let depth = 0; current && depth < MAX_DEPTH; depth += 1) {
      const total = totals.get(current.id);
      total.productCount += category.productCount;
      if (category.lastModified && (!total.lastModified || category.lastModified > total.lastModified)) total.lastModified = category.lastModified;
      current = current.parentId && current.parentId !== current.id ? byId.get(current.parentId) : undefined;
    }
  }
  return totals;
}
