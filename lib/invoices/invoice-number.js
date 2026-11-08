import { nextSequence } from "@/lib/db/models/Counter";

/** GST rule 46: at most 16 characters, made of letters, digits, "-" and "/". */
const MAX_LENGTH = 16;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const twoDigits = (year) => String(year % 100).padStart(2, "0");

/**
 * Indian financial year (April to March, in IST) that `date` falls in, e.g. "25-26".
 * @param {Date} [date]
 */
export function financialYearLabel(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const startYear = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${twoDigits(startYear)}-${twoDigits(startYear + 1)}`;
}

/**
 * `PREFIX/FY/SERIAL`, e.g. "INV/25-26/00042": unique and consecutive per store
 * and financial year. The store prefix is cut to fit 16 characters, and dropped
 * if it still would not.
 * @param {{ prefix?: string, financialYear: string, sequence: number }} parts
 */
export function formatInvoiceNumber({ prefix, financialYear, sequence }) {
  const serial = String(sequence).padStart(5, "0");
  const code = String(prefix ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const full = [code, financialYear, serial].filter(Boolean).join("/");
  return full.length <= MAX_LENGTH ? full : `${financialYear}/${serial}`;
}

/**
 * Takes the next invoice number of the current store. Call it inside the
 * transaction that records the sale, so a sale that rolls back leaves no gap.
 * @param {{ prefix?: string, at?: Date, session?: import("mongoose").ClientSession }} options
 */
export async function allocateInvoiceNumber({ prefix, at = new Date(), session }) {
  const financialYear = financialYearLabel(at);
  const sequence = await nextSequence(`invoice:${financialYear}`, session);
  return formatInvoiceNumber({ prefix, financialYear, sequence });
}
