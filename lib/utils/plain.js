/**
 * A plain JSON copy of server data (ObjectIds and dates become strings), safe
 * to pass from a Server Component to a Client Component.
 * @template T
 * @param {T} value
 * @returns {any}
 */
export const toPlain = (value) => JSON.parse(JSON.stringify(value));
