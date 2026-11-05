/**
 * GST figures for invoices, rebuilt from the order snapshot so they always add
 * up to what the customer was charged (order.totalAmount).
 */

/** GST state codes (first two digits of a GSTIN). */
export const GST_STATE_CODES = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  Punjab: "03",
  Chandigarh: "04",
  Uttarakhand: "05",
  Haryana: "06",
  Delhi: "07",
  Rajasthan: "08",
  "Uttar Pradesh": "09",
  Bihar: "10",
  Sikkim: "11",
  "Arunachal Pradesh": "12",
  Nagaland: "13",
  Manipur: "14",
  Mizoram: "15",
  Tripura: "16",
  Meghalaya: "17",
  Assam: "18",
  "West Bengal": "19",
  Jharkhand: "20",
  Odisha: "21",
  Chhattisgarh: "22",
  "Madhya Pradesh": "23",
  Gujarat: "24",
  "Dadra and Nagar Haveli and Daman and Diu": "26",
  Maharashtra: "27",
  Karnataka: "29",
  Goa: "30",
  Lakshadweep: "31",
  Kerala: "32",
  "Tamil Nadu": "33",
  Puducherry: "34",
  "Andaman and Nicobar Islands": "35",
  Telangana: "36",
  "Andhra Pradesh": "37",
  Ladakh: "38",
};

const STATE_BY_CODE = new Map(Object.entries(GST_STATE_CODES).map(([name, code]) => [code, name]));
const CODE_BY_KEY = new Map(Object.entries(GST_STATE_CODES).map(([name, code]) => [stateKey(name), code]));
// Common alternative spellings found in typed addresses.
for (const [alias, code] of [["orissa", "21"], ["pondicherry", "34"], ["newdelhi", "07"], ["nctofdelhi", "07"], ["jammukashmir", "01"], ["andamannicobar", "35"], ["damananddiu", "26"], ["dadranagarhaveli", "26"]]) {
  CODE_BY_KEY.set(alias, code);
}

/** GST rate slabs, used to recover the store default rate an older order was taxed at. */
const GST_SLABS = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];

function stateKey(name) {
  return String(name ?? "").toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
}

export const roundPaise = (amount) => Math.round((Number(amount) + Number.EPSILON) * 100) / 100;

/** State code for a state name ("Tamil Nadu" → "33"), or null. */
export function stateCodeForName(name) {
  return CODE_BY_KEY.get(stateKey(name)) ?? null;
}

/** State code a GSTIN was registered in ("33ABCDE1234F1Z5" → "33"), or null. */
export function stateCodeFromGstin(gstin) {
  const code = /^(\d{2})[A-Z0-9]{13}$/i.exec(String(gstin ?? "").trim())?.[1];
  return code && STATE_BY_CODE.has(code) ? code : null;
}

export function stateNameForCode(code) {
  return STATE_BY_CODE.get(code) ?? null;
}

/**
 * Rate of the store default at order time. Lines without their own rate and
 * shipping were taxed at it; the order stores only the total, so the rate is
 * recovered from it and snapped to the nearest GST slab.
 */
function impliedDefaultRate(order) {
  const items = order.items ?? [];
  const explicitTax = items
    .filter((item) => item.gstRatePercent != null)
    .reduce((sum, item) => sum + Number(item.lineTotal) * (Number(item.gstRatePercent) / 100), 0);
  const base =
    items.filter((item) => item.gstRatePercent == null).reduce((sum, item) => sum + Number(item.lineTotal), 0) +
    Number(order.shippingCharges ?? 0);
  if (base <= 0) return 0;
  const rate = (Math.max(0, Number(order.tax ?? 0) - explicitTax) / base) * 100;
  const slab = GST_SLABS.reduce((best, candidate) => (Math.abs(candidate - rate) < Math.abs(best - rate) ? candidate : best));
  return Math.abs(slab - rate) <= 0.25 ? slab : roundPaise(rate);
}

function splitTax(taxable, rate, interState) {
  const tax = roundPaise((taxable * rate) / 100);
  if (interState) return { tax, igst: tax, cgst: 0, sgst: 0 };
  const cgst = roundPaise(tax / 2);
  return { tax, igst: 0, cgst, sgst: roundPaise(tax - cgst) };
}

/**
 * Lines, tax split and totals for an invoice.
 * Intra-state supplies (seller's GSTIN state = place of supply) carry CGST + SGST;
 * everything else IGST. The place of supply for goods is where they are delivered.
 * @param {any} order Order document or plain object
 * @param {{ sellerGstin?: string }} [seller]
 */
export function buildInvoiceTax(order, { sellerGstin = "" } = {}) {
  const sellerStateCode = stateCodeFromGstin(sellerGstin);
  const supplyAddress = order.shippingAddress ?? order.billingAddress ?? {};
  const placeOfSupplyCode = stateCodeForName(supplyAddress.state);
  // Without both states the split can't be decided; IGST is the safe default.
  const interState = !sellerStateCode || !placeOfSupplyCode || sellerStateCode !== placeOfSupplyCode;
  const defaultRate = impliedDefaultRate(order);

  const lines = (order.items ?? []).map((item, index) => {
    const taxable = roundPaise(item.lineTotal);
    const rate = item.gstRatePercent ?? defaultRate;
    const split = splitTax(taxable, rate, interState);
    return {
      index: index + 1,
      description: item.productName,
      details: [item.sku && `SKU ${item.sku}`, item.colorName && `Colour: ${item.colorName}`].filter(Boolean).join("  ·  "),
      hsn: item.hsnCode || "",
      quantity: Number(item.quantity),
      unitPrice: roundPaise(item.unitPrice),
      taxable,
      rate,
      ...split,
      amount: roundPaise(taxable + split.tax),
    };
  });

  const shippingCharges = roundPaise(order.shippingCharges ?? 0);
  if (shippingCharges > 0) {
    const split = splitTax(shippingCharges, defaultRate, interState);
    lines.push({
      index: lines.length + 1,
      description: "Shipping & handling",
      details: "",
      hsn: "",
      quantity: 1,
      unitPrice: shippingCharges,
      taxable: shippingCharges,
      rate: defaultRate,
      ...split,
      amount: roundPaise(shippingCharges + split.tax),
    });
  }

  const sum = (key) => roundPaise(lines.reduce((total, line) => total + line[key], 0));
  const discount = roundPaise(order.discount ?? 0);
  const taxable = sum("taxable");
  const cgst = sum("cgst");
  const sgst = sum("sgst");
  const igst = sum("igst");
  const tax = roundPaise(cgst + sgst + igst);
  const grandTotal = roundPaise(order.totalAmount);
  // Absorbs per-line rounding so the invoice matches the amount actually charged.
  const roundOff = roundPaise(grandTotal - (taxable - discount + tax));

  // HSN-wise summary, as GST invoices list it.
  const summary = new Map();
  for (const line of lines) {
    const key = `${line.hsn}|${line.rate}`;
    const row = summary.get(key) ?? { hsn: line.hsn, rate: line.rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
    for (const field of ["taxable", "cgst", "sgst", "igst", "tax"]) row[field] = roundPaise(row[field] + line[field]);
    summary.set(key, row);
  }

  return {
    lines,
    hsnSummary: [...summary.values()],
    interState,
    /** False when the seller's or the buyer's state is unknown: the tax is then shown as plain GST. */
    splitKnown: Boolean(sellerStateCode && placeOfSupplyCode),
    sellerStateCode,
    placeOfSupply: {
      code: placeOfSupplyCode,
      name: placeOfSupplyCode ? stateNameForCode(placeOfSupplyCode) : supplyAddress.state || "",
    },
    totals: {
      itemsSubtotal: roundPaise(order.subtotal),
      shipping: shippingCharges,
      discount,
      taxable,
      cgst,
      sgst,
      igst,
      tax,
      roundOff: Math.abs(roundOff) < 0.005 ? 0 : roundOff,
      grandTotal,
    },
  };
}
