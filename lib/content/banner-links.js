/**
 * Whether a hero slide's button leads somewhere with products: a category or
 * product type with nothing on sale (say, a type just switched off) is a dead
 * end, so the slide is left out of the rotation. Other links (the catalogue,
 * quotes, pages, other sites) always count. A null set means "unknown", which
 * keeps the slide.
 * @param {string} href
 * @param {Set<string> | null} categorySlugs categories with products on sale (theirs or their subcategories')
 * @param {Set<string> | null} typeSlugs product types on sale with products
 * @returns {boolean}
 */
export function leadsToProducts(href, categorySlugs, typeSlugs) {
  let path = String(href ?? "").split(/[?#]/)[0].toLowerCase().replace(/\/+$/, "");
  try {
    path = decodeURIComponent(path);
  } catch {
    // A malformed escape in an admin-typed link: judge it as written.
  }
  const category = path.match(/^\/categories\/([^/]+)$/);
  if (category) return !categorySlugs || categorySlugs.has(category[1]);
  const type = path.match(/^\/shop\/([^/]+)$/);
  if (type) return !typeSlugs || typeSlugs.has(type[1]);
  return true;
}
