const FORBIDDEN_KEY_PATTERN = /^\$/;

/** Logical operators whose values are arrays of sub-filters. */
const LOGICAL_OPERATORS = new Set(["$or", "$and", "$nor"]);

/**
 * Safe query operators for server-composed filters. Anything else starting with `$`
 * (e.g. `$where`, `$function`) is dropped to block operator injection.
 */
const ALLOWED_QUERY_OPERATORS = new Set([
  ...LOGICAL_OPERATORS,
  "$in",
  "$nin",
  "$all",
  "$gte",
  "$lte",
  "$gt",
  "$lt",
  "$ne",
  "$eq",
  "$exists",
  "$regex",
  "$options",
  "$elemMatch",
]);

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
 * @param {unknown} node
 */
function sanitizeFilterValue(node) {
  if (node instanceof RegExp || node instanceof Date) return node;
  if (Array.isArray(node)) {
    return node.map((item) => sanitizeFilterValue(item));
  }
  if (node && typeof node === "object") {
    /** @type {Record<string, unknown>} */
    const output = {};
    for (const [key, value] of Object.entries(node)) {
      if (key.includes(".")) continue;

      if (FORBIDDEN_KEY_PATTERN.test(key)) {
        if (!ALLOWED_QUERY_OPERATORS.has(key)) continue;
        if (LOGICAL_OPERATORS.has(key)) {
          if (!Array.isArray(value)) continue;
          output[key] = value.map((branch) => sanitizeFilterValue(branch));
          continue;
        }
        output[key] = sanitizeFilterValue(value);
        continue;
      }

      output[key] = sanitizeFilterValue(value);
    }
    return output;
  }
  return node;
}

/**
 * Sanitises a Mongoose filter document: strips dangerous `$` operators while
 * preserving whitelisted query shapes built in repositories (e.g. `$or` search).
 * @param {Record<string, unknown>} filter
 */
export function sanitizeMongoFilter(filter) {
  return /** @type {Record<string, unknown>} */ (sanitizeFilterValue(filter));
}
