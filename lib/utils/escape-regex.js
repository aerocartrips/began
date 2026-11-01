/**
 * Escapes user input for safe use inside a RegExp (prevents regex injection / ReDoS).
 * @param {unknown} value
 */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
