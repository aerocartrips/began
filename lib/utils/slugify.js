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

/** Old slugs kept per document, so its old URLs keep redirecting. */
const MAX_PREVIOUS_SLUGS = 20;

/**
 * `previous` with `oldSlug` added and `newSlug` removed (a document can move back to an earlier slug).
 * @param {string[] | undefined} previous
 * @param {string} oldSlug
 * @param {string} newSlug
 */
export function rememberSlug(previous, oldSlug, newSlug) {
  return [...new Set([...(previous ?? []), oldSlug])].filter((slug) => slug && slug !== newSlug).slice(-MAX_PREVIOUS_SLUGS);
}
