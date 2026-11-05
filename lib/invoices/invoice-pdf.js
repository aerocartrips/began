import { createPdfDocument } from "@/lib/invoices/pdfkit-document";
import { amountInWords } from "@/lib/invoices/amount-in-words";

/**
 * A4 invoice layout (PDFKit). Pure rendering: takes the model built by
 * invoice.service.js and returns the PDF bytes. A typical order fits on one
 * page; long orders continue the item table on further pages (header
 * repeated), and blocks never split across a page break.
 *
 * The built-in PDF fonts have no rupee glyph, so amounts are printed with
 * Indian digit grouping under "INR" headings, as many GST invoices do.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const TOP = 32;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
/** Content stops here; the footer sits below. */
const CONTENT_BOTTOM = PAGE_HEIGHT - 50;
const FONT = "Helvetica";
const BOLD = "Helvetica-Bold";
const INK = "#1d2433";
const MUTED = "#6b7280";
const LINE = "#e3e6ec";
const SOFT = "#f6f7fa";
const DEFAULT_BRAND = "#6863ed";
const CELL_PAD = 4;

const MONEY = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatMoney = (value) => MONEY.format(Number(value) || 0);
const formatRate = (rate) => `${Number(Number(rate).toFixed(2))}%`;

function hexToRgb(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** `hex` blended toward white: a light tint for table headings. */
function tint(hex, amount) {
  const rgb = hexToRgb(hex) ?? hexToRgb(DEFAULT_BRAND);
  return `#${rgb.map((channel) => Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function write(doc, value, x, y, { width, size = 8.5, font = FONT, color = INK, align = "left", lineGap = 1.5, characterSpacing = 0 } = {}) {
  doc.font(font).fontSize(size).fillColor(color).text(String(value ?? ""), x, y, { width, align, lineGap, characterSpacing });
  return doc.y;
}

function measure(doc, value, width, { size = 8.5, font = FONT, lineGap = 1.5, characterSpacing = 0 } = {}) {
  return doc.font(font).fontSize(size).heightOfString(String(value ?? ""), { width, lineGap, characterSpacing });
}

function rule(doc, y, { x = MARGIN, width = CONTENT_WIDTH, color = LINE, weight = 0.75 } = {}) {
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(weight).strokeColor(color).stroke();
}

const LABEL = { size: 7, font: BOLD, color: MUTED, characterSpacing: 0.8 };

/** Small uppercase section heading; returns the y below it. */
function label(doc, text, x, y, width) {
  return write(doc, text.toUpperCase(), x, y, { width, ...LABEL });
}

/** Starts a new page when `height` doesn't fit below `y`. */
function fit(doc, y, height) {
  if (y + height <= CONTENT_BOTTOM) return y;
  doc.addPage();
  return TOP;
}

/** Tinted heading row of a table; its height follows the longest (wrapped) title. */
function tableHeader(doc, columns, x, y, background, size = 7) {
  const style = { size, font: BOLD, characterSpacing: 0.4 };
  const height = Math.max(...columns.map((column) => measure(doc, column.title.toUpperCase(), column.width - CELL_PAD * 2, style))) + 11;
  doc.rect(x, y, columns.reduce((sum, column) => sum + column.width, 0), height).fill(background);
  let cursor = x;
  for (const column of columns) {
    write(doc, column.title.toUpperCase(), cursor + CELL_PAD, y + 5.5, { width: column.width - CELL_PAD * 2, align: column.align, ...style });
    cursor += column.width;
  }
  return y + height;
}

function drawHeader(doc, model) {
  const { seller } = model;
  doc.rect(0, 0, PAGE_WIDTH, 5).fill(seller.brand);

  // Seller identity (left).
  const leftWidth = 290;
  let left = TOP;
  let logoDrawn = false;
  if (seller.logo) {
    try {
      doc.image(seller.logo, MARGIN, left, { fit: [170, 44], align: "left", valign: "top" });
      left += 52;
      logoDrawn = true;
    } catch {
      // Not a usable image: the store name stands in.
    }
  }
  if (!logoDrawn) left = write(doc, seller.displayName, MARGIN, left, { width: leftWidth, size: 18, font: BOLD, color: seller.brand }) + 3;
  if (seller.legalName && seller.legalName !== seller.displayName) {
    left = write(doc, seller.legalName, MARGIN, left, { width: leftWidth, size: 10, font: BOLD }) + 2;
  }
  const identity = [
    seller.gstin ? `GSTIN: ${seller.gstin}` : "",
    seller.stateName ? `State: ${seller.stateName}${seller.stateCode ? ` (${seller.stateCode})` : ""}` : "",
  ].filter(Boolean).join("     ");
  const contact = [seller.email, seller.phone, seller.website].filter(Boolean).join("     ");
  for (const line of [...seller.addressLines, identity, contact].filter(Boolean)) {
    left = write(doc, line, MARGIN, left, { width: leftWidth, size: 8, color: MUTED }) + 1;
  }

  // Document title, payment stamp and reference numbers (right).
  const rightX = MARGIN + 305;
  const rightWidth = CONTENT_WIDTH - 305;
  let right = write(doc, model.title.toUpperCase(), rightX, TOP - 2, { width: rightWidth, size: 16, font: BOLD, align: "right", characterSpacing: 1.2 }) + 2;
  const stamp = model.status;
  doc.font(BOLD).fontSize(7);
  const stampWidth = doc.widthOfString(stamp.text, { characterSpacing: 0.8 }) + 16;
  doc.roundedRect(rightX, right, stampWidth, 15, 7.5).fill(stamp.background);
  write(doc, stamp.text, rightX, right + 4.5, { width: stampWidth, size: 7, font: BOLD, color: stamp.color, align: "center", characterSpacing: 0.8 });
  write(doc, model.copyLabel, rightX + stampWidth + 8, right + 4, { width: rightWidth - stampWidth - 8, size: 7.5, color: MUTED, align: "right" });
  right += 22;
  const labelWidth = rightWidth * 0.42;
  for (const [name, value] of model.meta) {
    write(doc, name, rightX, right, { width: labelWidth, size: 8, color: MUTED, lineGap: 1 });
    right = write(doc, value, rightX + labelWidth, right, { width: rightWidth - labelWidth, size: 8, font: BOLD, align: "right", lineGap: 1 }) + 1.5;
  }

  const bottom = Math.max(left, right) + 8;
  rule(doc, bottom);
  return bottom + 12;
}

/** Lines of a Billed to / Shipped to panel, shared by measuring and drawing. */
function partyRows(party) {
  const codes = [party.gstin ? `GSTIN: ${party.gstin}` : "", party.stateCode ? `State code: ${party.stateCode}` : ""].filter(Boolean).join("     ");
  return [
    { text: party.name, font: BOLD, size: 9.5 },
    party.company ? { text: party.company, font: BOLD, size: 8 } : null,
    ...party.addressLines.map((text) => ({ text, size: 8, color: MUTED })),
    codes ? { text: codes, size: 8 } : null,
    party.phone || party.email ? { text: [party.phone, party.email].filter(Boolean).join("     "), size: 8, color: MUTED } : null,
  ].filter((row) => row && row.text);
}

function drawParties(doc, model, y) {
  const gap = 14;
  const pad = 10;
  const width = (CONTENT_WIDTH - gap) / 2;
  const inner = width - pad * 2;
  const panels = [["Billed to", model.billTo], ["Shipped to", model.shipTo]];
  const contentHeight = Math.max(
    ...panels.map(([, party]) => partyRows(party).reduce((sum, row) => sum + measure(doc, row.text, inner, row) + 1, 0)),
  );
  const height = contentHeight + pad * 2 + 12;
  y = fit(doc, y, height);

  panels.forEach(([title, party], index) => {
    const x = MARGIN + index * (width + gap);
    doc.roundedRect(x, y, width, height, 6).fill(SOFT);
    let cursor = label(doc, title, x + pad, y + pad, inner) + 4;
    for (const row of partyRows(party)) cursor = write(doc, row.text, x + pad, cursor, { width: inner, ...row }) + 1;
  });
  return y + height + 14;
}

const ITEM_COLUMNS = [
  { key: "index", title: "#", width: 18 },
  { key: "description", title: "Item", width: 172 },
  { key: "hsn", title: "HSN/SAC", width: 42 },
  { key: "quantity", title: "Qty", width: 26, align: "right" },
  { key: "unitPrice", title: "Rate", width: 54, align: "right" },
  { key: "taxable", title: "Taxable value", width: 60, align: "right" },
  { key: "rate", title: "GST", width: 30, align: "right" },
  { key: "tax", title: "GST amount", width: 48, align: "right" },
  { key: "amount", title: "Amount", width: 65.28, align: "right" },
];

function itemCells(line) {
  return {
    index: String(line.index),
    hsn: line.hsn || "—",
    quantity: String(line.quantity),
    unitPrice: formatMoney(line.unitPrice),
    taxable: formatMoney(line.taxable),
    rate: formatRate(line.rate),
    tax: formatMoney(line.tax),
    amount: formatMoney(line.amount),
  };
}

function drawItems(doc, model, y) {
  const headingTint = tint(model.seller.brand, 0.9);
  const descriptionWidth = ITEM_COLUMNS[1].width - CELL_PAD * 2;
  y = fit(doc, y, 70);
  y = label(doc, "Order items (amounts in INR)", MARGIN, y, CONTENT_WIDTH) + 5;
  y = tableHeader(doc, ITEM_COLUMNS, MARGIN, y, headingTint);

  model.tax.lines.forEach((line, index) => {
    const descriptionHeight =
      measure(doc, line.description, descriptionWidth, { font: BOLD }) + (line.details ? measure(doc, line.details, descriptionWidth, { size: 7 }) + 1.5 : 0);
    const height = Math.max(descriptionHeight, 10) + 9;
    if (y + height > CONTENT_BOTTOM) {
      doc.addPage();
      y = label(doc, `Order items, continued: ${model.number}`, MARGIN, TOP, CONTENT_WIDTH) + 5;
      y = tableHeader(doc, ITEM_COLUMNS, MARGIN, y, headingTint);
    }
    if (index % 2 === 1) doc.rect(MARGIN, y, CONTENT_WIDTH, height).fill(SOFT);

    const cells = itemCells(line);
    let x = MARGIN;
    for (const column of ITEM_COLUMNS) {
      const width = column.width - CELL_PAD * 2;
      if (column.key === "description") {
        const bottom = write(doc, line.description, x + CELL_PAD, y + 4.5, { width, font: BOLD });
        if (line.details) write(doc, line.details, x + CELL_PAD, bottom + 1.5, { width, size: 7, color: MUTED });
      } else {
        write(doc, cells[column.key], x + CELL_PAD, y + 4.5, { width, align: column.align, font: column.key === "amount" ? BOLD : FONT });
      }
      x += column.width;
    }
    y += height;
    rule(doc, y, { weight: 0.5 });
  });
  return y + 14;
}

/** HSN-wise tax summary: CGST + SGST for intra-state supply, IGST otherwise. */
function summaryColumns(interState, splitKnown) {
  const single = splitKnown ? "IGST" : "GST";
  return interState
    ? [
        { key: "hsn", title: "HSN/SAC", width: 62 },
        { key: "taxable", title: "Taxable value", width: 78, align: "right" },
        { key: "rate", title: `${single} rate`, width: 50, align: "right" },
        { key: "igst", title: single, width: 60, align: "right" },
        { key: "tax", title: "Total tax", width: 55, align: "right" },
      ]
    : [
        { key: "hsn", title: "HSN/SAC", width: 50 },
        { key: "taxable", title: "Taxable value", width: 66, align: "right" },
        { key: "rate", title: "GST rate", width: 40, align: "right" },
        { key: "cgst", title: "CGST", width: 50, align: "right" },
        { key: "sgst", title: "SGST", width: 50, align: "right" },
        { key: "tax", title: "Total tax", width: 49, align: "right" },
      ];
}

function summaryRows(tax) {
  const total = tax.hsnSummary.reduce(
    (sum, row) => ({ ...sum, taxable: sum.taxable + row.taxable, cgst: sum.cgst + row.cgst, sgst: sum.sgst + row.sgst, igst: sum.igst + row.igst, tax: sum.tax + row.tax }),
    { hsn: "Total", taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 },
  );
  const cells = (row) => ({
    hsn: row.hsn || "—",
    taxable: formatMoney(row.taxable),
    rate: row.rate === undefined ? "" : formatRate(row.rate),
    igst: formatMoney(row.igst),
    cgst: formatMoney(row.cgst),
    sgst: formatMoney(row.sgst),
    tax: formatMoney(row.tax),
  });
  return [...tax.hsnSummary.map((row) => ({ cells: cells(row), bold: false })), { cells: cells(total), bold: true }];
}

function totalsRows(model) {
  const { totals, interState, splitKnown } = model.tax;
  return [
    ["Items subtotal", formatMoney(totals.itemsSubtotal)],
    totals.shipping ? ["Shipping & handling", formatMoney(totals.shipping)] : null,
    totals.discount ? ["Discount", `- ${formatMoney(totals.discount)}`] : null,
    ["Taxable value", formatMoney(totals.taxable - totals.discount)],
    ...(interState ? [[splitKnown ? "IGST" : "GST", formatMoney(totals.igst)]] : [["CGST", formatMoney(totals.cgst)], ["SGST", formatMoney(totals.sgst)]]),
    totals.roundOff ? ["Round off", `${totals.roundOff > 0 ? "+ " : "- "}${formatMoney(Math.abs(totals.roundOff))}`] : null,
  ].filter(Boolean);
}

const SUMMARY_ROW = 15;
const PAYMENT_ROW = 13;
const NOTE_STYLE = { size: 7.5, color: MUTED };

/**
 * Everything after the items, kept together on one page:
 * amount in words, tax summary, payment and terms on the left; totals and the
 * signatory on the right.
 */
function drawSummary(doc, model, y) {
  const { tax, seller } = model;
  const rightWidth = 190;
  const leftWidth = CONTENT_WIDTH - rightWidth - 20;
  const rightX = MARGIN + leftWidth + 20;
  const columns = summaryColumns(tax.interState, tax.splitKnown);
  const words = amountInWords(tax.totals.grandTotal);
  const rows = summaryRows(tax);
  const totals = totalsRows(model);
  const payment = model.payment.filter(([, value]) => value);
  const signatory = `For ${seller.legalName || seller.displayName}`;
  const headerHeight = Math.max(...columns.map((column) => measure(doc, column.title.toUpperCase(), column.width - CELL_PAD * 2, { size: 6.5, font: BOLD, characterSpacing: 0.4 }))) + 11;

  const leftHeight =
    12 + measure(doc, words, leftWidth, { font: BOLD }) + 12 +
    12 + headerHeight + rows.length * SUMMARY_ROW +
    (payment.length ? 10 + 12 + payment.length * PAYMENT_ROW : 0) +
    12 + 12 + model.notes.reduce((sum, note) => sum + measure(doc, note, leftWidth, NOTE_STYLE) + 3, 0);
  const rightHeight = totals.length * 15 + 34 + model.settlement.length * 14 + 22 + measure(doc, signatory, rightWidth, { font: BOLD }) + 50;
  y = fit(doc, y, Math.max(leftHeight, rightHeight));
  const top = y;

  let left = label(doc, "Amount in words", MARGIN, top, leftWidth) + 3;
  left = write(doc, words, MARGIN, left, { width: leftWidth, font: BOLD }) + 12;
  left = label(doc, "Tax summary (INR)", MARGIN, left, leftWidth) + 4;
  left = tableHeader(doc, columns, MARGIN, left, tint(seller.brand, 0.9), 6.5);
  for (const row of rows) {
    let x = MARGIN;
    for (const column of columns) {
      write(doc, row.cells[column.key], x + CELL_PAD, left + 4, { width: column.width - CELL_PAD * 2, size: 7.5, font: row.bold ? BOLD : FONT, align: column.align });
      x += column.width;
    }
    left += SUMMARY_ROW;
    rule(doc, left, { width: leftWidth, weight: 0.5 });
  }
  if (payment.length) {
    left = label(doc, "Payment", MARGIN, left + 10, leftWidth) + 3;
    for (const [name, value] of payment) {
      write(doc, name, MARGIN, left, { width: 92, size: 8, color: MUTED });
      write(doc, value, MARGIN + 92, left, { width: leftWidth - 92, size: 8, font: BOLD });
      left += PAYMENT_ROW;
    }
  }
  left = label(doc, "Declaration & terms", MARGIN, left + 12, leftWidth) + 4;
  for (const note of model.notes) left = write(doc, note, MARGIN, left, { width: leftWidth, ...NOTE_STYLE }) + 3;

  let right = top;
  for (const [name, value] of totals) {
    write(doc, name, rightX, right, { width: rightWidth * 0.55, color: MUTED });
    write(doc, value, rightX + rightWidth * 0.45, right, { width: rightWidth * 0.55, align: "right" });
    right += 15;
  }
  right += 2;
  doc.roundedRect(rightX, right, rightWidth, 26, 5).fill(INK);
  write(doc, "Total (INR)", rightX + 10, right + 8.5, { width: rightWidth * 0.5, size: 9.5, font: BOLD, color: "#ffffff" });
  write(doc, formatMoney(tax.totals.grandTotal), rightX + rightWidth * 0.35, right + 7.5, { width: rightWidth * 0.65 - 10, size: 11, font: BOLD, color: "#ffffff", align: "right" });
  right += 34;
  for (const [name, value, strong] of model.settlement) {
    const font = strong ? BOLD : FONT;
    write(doc, name, rightX, right, { width: rightWidth * 0.55, color: strong ? INK : MUTED, font });
    write(doc, value, rightX + rightWidth * 0.45, right, { width: rightWidth * 0.55, align: "right", font });
    right += 14;
  }

  // Signatory, aligned with the bottom of the left column.
  const signatoryHeight = measure(doc, signatory, rightWidth, { font: BOLD }) + 50;
  const signatoryTop = Math.max(right + 22, left - signatoryHeight);
  const signatureLine = write(doc, signatory, rightX, signatoryTop, { width: rightWidth, font: BOLD, align: "right" }) + 34;
  rule(doc, signatureLine, { x: rightX + rightWidth * 0.2, width: rightWidth * 0.8, color: "#c9ced8" });
  write(doc, "Authorised signatory", rightX, signatureLine + 5, { width: rightWidth, size: 7.5, color: MUTED, align: "right" });

  return Math.max(left, signatureLine + 16);
}

function drawFooters(doc, model) {
  const { start, count } = doc.bufferedPageRange();
  const owner = [model.seller.legalName || model.seller.displayName, model.seller.gstin ? `GSTIN ${model.seller.gstin}` : ""].filter(Boolean).join("   ·   ");
  for (let index = start; index < start + count; index += 1) {
    doc.switchToPage(index);
    const y = PAGE_HEIGHT - 32;
    rule(doc, y - 8, { weight: 0.5 });
    write(doc, owner, MARGIN, y, { width: CONTENT_WIDTH * 0.62, size: 7, color: MUTED });
    write(doc, `${model.number}   ·   Page ${index - start + 1} of ${count}`, MARGIN + CONTENT_WIDTH * 0.5, y, { width: CONTENT_WIDTH * 0.5, size: 7, color: MUTED, align: "right" });
    if (index === start + count - 1) {
      write(doc, "This is a computer-generated invoice and does not require a physical signature.", MARGIN, y + 10, { width: CONTENT_WIDTH, size: 6.5, color: MUTED, align: "center" });
    }
  }
}

/**
 * @param {ReturnType<typeof import("@/lib/invoices/invoice.service").buildInvoiceModel>} model
 * @returns {Promise<Buffer>}
 */
export function renderInvoicePdf(model) {
  const doc = createPdfDocument({
    size: "A4",
    // A small bottom margin keeps PDFKit from breaking pages on its own; the layout decides.
    margins: { top: TOP, bottom: 8, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: `${model.title} ${model.number}`,
      Author: model.seller.legalName || model.seller.displayName,
      Subject: `Order ${model.orderNumber}`,
      Creator: model.seller.displayName,
    },
  });
  /** @type {Buffer[]} */
  const chunks = [];

  return new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      let y = drawHeader(doc, model);
      y = drawParties(doc, model, y);
      y = drawItems(doc, model, y);
      drawSummary(doc, model, y);
      drawFooters(doc, model);
      doc.end();
    } catch (error) {
      doc.destroy?.();
      reject(error);
    }
  });
}
