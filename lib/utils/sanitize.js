const FORBIDDEN_KEY_PATTERN = /^\$/;

/**
 * @param {unknown} input
 */
export function sanitizeInput(input) {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item));
  }
  if (input && typeof input === "object") {
    /** @type {Record<string, unknown>} */
    const output = {};
    for (const [key, value] of Object.entries(input)) {
      if (FORBIDDEN_KEY_PATTERN.test(key) || key.includes(".")) continue;
      output[key] = sanitizeInput(value);
    }
    return output;
  }
  return input;
}

/**
 * @param {Record<string, unknown>} filter
 */
export function sanitizeMongoFilter(filter) {
  return /** @type {Record<string, unknown>} */ (sanitizeInput(filter));
}
