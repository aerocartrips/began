import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Load pdfkit via Node resolution (avoids Turbopack font path issues). */
const PDFDocument = require("pdfkit");

/**
 * @param {ConstructorParameters<typeof PDFDocument>[0]} options
 */
export function createPdfDocument(options) {
  return new PDFDocument(options);
}
