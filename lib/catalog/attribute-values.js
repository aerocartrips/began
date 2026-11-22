import { ATTRIBUTE_INPUTS, BOOLEAN_VALUES, LISTED_INPUTS } from "@/lib/constants/catalog";

/**
 * Attribute values: how raw input becomes the stored canonical value, and how
 * stored values read on the storefront. Pure functions shared by the product
 * service, the catalogue upgrade, storefront DTOs and the admin form.
 *
 * @typedef {{ key: string, name: string, input: string, unit?: string,
 *   values?: { label: string, hex?: string, isActive?: boolean }[] }} AttributeLike
 */

const YES = new Set(["yes", "y", "true", "1", "included", "on"]);
const NO = new Set(["no", "n", "false", "0", "not included", "off"]);

/**
 * The stored form of one raw value, or an error message. List inputs match
 * their list whatever the letter case and return the list's spelling.
 * @param {AttributeLike} attribute
 * @param {unknown} raw
 * @returns {{ value: string } | { error: string }}
 */
export function canonicalizeValue(attribute, raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { value: "" };
  if (LISTED_INPUTS.includes(attribute.input)) {
    const lower = text.toLowerCase();
    const match = (attribute.values ?? []).find((value) => value.label.toLowerCase() === lower);
    return match ? { value: match.label } : { error: `“${text}” isn't one of the ${attribute.name} values. Add it to the list first.` };
  }
  if (attribute.input === ATTRIBUTE_INPUTS.NUMBER) {
    const number = Number(text.replace(/,/g, "").replace(new RegExp(`\\s*${escape(attribute.unit ?? "")}$`, "i"), ""));
    return Number.isFinite(number) ? { value: String(number) } : { error: `${attribute.name} must be a number.` };
  }
  if (attribute.input === ATTRIBUTE_INPUTS.BOOLEAN) {
    const lower = text.toLowerCase();
    if (YES.has(lower)) return { value: BOOLEAN_VALUES.YES };
    if (NO.has(lower)) return { value: BOOLEAN_VALUES.NO };
    return { error: `${attribute.name} must be yes or no.` };
  }
  return { value: text.slice(0, 200) };
}

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * How stored values read on the storefront: "6.3 m", "Zari, Sequins", "Yes".
 * @param {AttributeLike} attribute
 * @param {string[]} values
 */
export function formatAttributeValues(attribute, values) {
  const present = values.filter(Boolean);
  if (!present.length) return "";
  if (attribute.input === ATTRIBUTE_INPUTS.NUMBER && attribute.unit) return present.map((value) => `${value} ${attribute.unit}`).join(", ");
  return present.join(", ");
}

/**
 * A product's `[{ key, value }]` details as `{ key: value | values[] }`, the
 * shape the admin form edits (multi-value attributes as arrays).
 * @param {{ key: string, value: string }[] | undefined} entries
 * @param {(key: string) => boolean} [isMulti]
 * @returns {Record<string, string | string[]>}
 */
export function attributeRecordOf(entries, isMulti = () => false) {
  /** @type {Record<string, string | string[]>} */
  const record = {};
  for (const entry of entries ?? []) {
    if (!entry?.key) continue;
    if (isMulti(entry.key)) {
      const list = Array.isArray(record[entry.key]) ? /** @type {string[]} */ (record[entry.key]) : [];
      record[entry.key] = [...list, entry.value];
    } else if (record[entry.key] === undefined) {
      record[entry.key] = entry.value;
    }
  }
  return record;
}

/**
 * Values of one key in a product's details.
 * @param {{ key: string, value: string }[] | undefined} entries
 * @param {string} key
 */
export function valuesOf(entries, key) {
  return (entries ?? []).filter((entry) => entry.key === key).map((entry) => entry.value);
}
