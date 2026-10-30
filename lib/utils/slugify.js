/**
 * @param {string} value
 */
export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * @param {string} base
 * @param {number} attempt
 */
export function withSlugSuffix(base, attempt) {
  if (attempt <= 1) return base;
  return `${base}-${attempt}`;
}
