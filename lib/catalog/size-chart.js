/**
 * Size chart helpers for the product page's size guide: reading measurements
 * written as text ("38", "38–40", "80-92"), converting them between inches and
 * centimetres, and the fit finder (one measurement in, a size out). Pure, so
 * they run in the browser and in tests.
 *
 * @typedef {import("@/features/catalog/types").SizeChartData} SizeChartData
 * @typedef {{ min: number, max: number }} Range
 */

const CM_PER_INCH = 2.54;
const NUMBER = /\d+(?:\.\d+)?/g;

/**
 * A cell's measurement as a range: "38" → 38–38, "38–40" → 38–40; null without numbers.
 * @param {string} cell
 * @returns {Range | null}
 */
export function parseMeasure(cell) {
  const numbers = (String(cell ?? "").match(NUMBER) ?? []).map(Number).filter(Number.isFinite);
  if (!numbers.length) return null;
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

/** One decimal at most: 96.52 → "96.5", 38.0 → "38". */
const tidyNumber = (value) => String(Math.round(value * 10) / 10);

/**
 * A length converted to another unit.
 * @param {number} value
 * @param {"in" | "cm"} from
 * @param {"in" | "cm"} to
 */
export function convertLength(value, from, to) {
  if (from === to) return value;
  return to === "cm" ? value * CM_PER_INCH : value / CM_PER_INCH;
}

/**
 * A cell with every number converted ("38–40" in → "96.5–101.6" cm); text without numbers stays as it is.
 * @param {string} cell
 * @param {"in" | "cm"} from
 * @param {"in" | "cm"} to
 */
export function convertCell(cell, from, to) {
  if (from === to) return cell;
  return String(cell ?? "").replace(NUMBER, (number) => tidyNumber(convertLength(Number(number), from, to)));
}

/** The column the fit finder asks about: the one marked primary, else the first measurement. */
export function primaryColumnIndex(chart) {
  const marked = chart.columns.findIndex((column) => column.primary && column.measurement !== false);
  if (marked !== -1) return marked;
  return chart.columns.findIndex((column) => column.measurement !== false);
}

/**
 * The size a shopper's measurement points to, read from the chart's primary
 * column: the first size whose measurement reaches theirs. Between two sizes,
 * the larger is suggested; beyond the chart, its last (or first) size.
 * @param {SizeChartData} chart
 * @param {number} measurement in `unit`
 * @param {"in" | "cm"} unit the unit the shopper used
 * @returns {{ size: string, fit: "within" | "between" | "below" | "above" } | null}
 */
export function recommendSize(chart, measurement, unit) {
  if (!Number.isFinite(measurement) || measurement <= 0) return null;
  const column = primaryColumnIndex(chart);
  if (column === -1) return null;
  const value = convertLength(measurement, unit, chart.unit);
  const rows = chart.rows
    .map((row) => ({ size: row.size, range: parseMeasure(row.values[column] ?? "") }))
    .filter((row) => row.range)
    .sort((left, right) => left.range.min - right.range.min);
  if (!rows.length) return null;

  // A little tolerance for rounding (half a centimetre).
  const slack = convertLength(0.5, "cm", chart.unit);
  if (value < rows[0].range.min - slack) return { size: rows[0].size, fit: "below" };
  for (const row of rows) {
    if (value <= row.range.max + slack) {
      return { size: row.size, fit: value >= row.range.min - slack ? "within" : "between" };
    }
  }
  return { size: rows.at(-1).size, fit: "above" };
}
