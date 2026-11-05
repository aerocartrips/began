import { describe, expect, it } from "vitest";
import { amountInWords } from "@/lib/invoices/amount-in-words";
import { buildInvoiceTax, stateCodeForName, stateCodeFromGstin } from "@/lib/invoices/gst";
import { buildInvoiceModel } from "@/lib/invoices/invoice.service";
import { renderInvoicePdf } from "@/lib/invoices/invoice-pdf";

const ADDRESS = {
  fullName: "Asha Rao",
  phone: "+91 98765 43210",
  addressLine1: "12 Weavers Lane",
  city: "Chennai",
  state: "Tamil Nadu",
  pincode: "600001",
  country: "India",
};

/** An order priced the way order-pricing.js prices it (GST on top, default rate 5%). */
function pricedOrder({ state = "Tamil Nadu", items, shippingCharges = 0, defaultRate = 5 }) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax =
    Math.round((items.reduce((sum, item) => sum + item.lineTotal * ((item.gstRatePercent ?? defaultRate) / 100), 0) + shippingCharges * (defaultRate / 100)) * 100) / 100;
  return {
    orderNumber: "NS-1001",
    createdAt: new Date("2026-11-05T09:00:00Z"),
    invoice: { number: "INV-NS-1001", issuedAt: new Date("2026-11-05T10:00:00Z") },
    items,
    shippingAddress: { ...ADDRESS, state },
    billingAddress: { ...ADDRESS, state, companyName: "Rao Silks", gstin: "33AAACR5055K1Z5" },
    subtotal,
    discount: 0,
    shippingCharges,
    tax,
    totalAmount: Math.round((subtotal + shippingCharges + tax) * 100) / 100,
    paymentMethod: "razorpay",
    paymentStatus: "paid",
  };
}

const item = (overrides) => ({ productName: "Kanjivaram saree", sku: "KJ-1", hsnCode: "5007", quantity: 2, unitPrice: 1000.5, lineTotal: 2001, gstRatePercent: 5, ...overrides });

describe("amountInWords", () => {
  it.each([
    [0, "Indian Rupees Zero Only"],
    [1, "Indian Rupees One Only"],
    [45, "Indian Rupees Forty-Five Only"],
    [100000, "Indian Rupees One Lakh Only"],
    [123456.5, "Indian Rupees One Lakh Twenty-Three Thousand Four Hundred Fifty-Six and Fifty Paise Only"],
    [10000001.01, "Indian Rupees One Crore One and One Paise Only"],
  ])("%s → %s", (amount, words) => {
    expect(amountInWords(amount)).toBe(words);
  });
});

describe("GST state codes", () => {
  it("reads state codes from names and GSTINs", () => {
    expect(stateCodeForName("Tamil Nadu")).toBe("33");
    expect(stateCodeForName("tamil nadu ")).toBe("33");
    expect(stateCodeForName("Orissa")).toBe("21");
    expect(stateCodeForName("Atlantis")).toBeNull();
    expect(stateCodeFromGstin("29ABCDE1234F1Z5")).toBe("29");
    expect(stateCodeFromGstin("ABC")).toBeNull();
  });
});

describe("buildInvoiceTax", () => {
  it("splits intra-state tax into CGST and SGST", () => {
    const order = pricedOrder({ items: [item()], shippingCharges: 100 });
    const { interState, totals, lines } = buildInvoiceTax(order, { sellerGstin: "33ABCDE1234F1Z5" });
    expect(interState).toBe(false);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ description: "Shipping & handling", taxable: 100, rate: 5, tax: 5 });
    expect(totals.igst).toBe(0);
    expect(totals.cgst + totals.sgst).toBeCloseTo(totals.tax, 2);
  });

  it("charges IGST when the goods go to another state", () => {
    const order = pricedOrder({ state: "Karnataka", items: [item()] });
    const { interState, totals } = buildInvoiceTax(order, { sellerGstin: "33ABCDE1234F1Z5" });
    expect(interState).toBe(true);
    expect(totals.cgst).toBe(0);
    expect(totals.igst).toBe(totals.tax);
  });

  it("shows plain GST when the seller's state is unknown (no GSTIN)", () => {
    const { interState, splitKnown, totals } = buildInvoiceTax(pricedOrder({ items: [item()] }), { sellerGstin: "" });
    expect(splitKnown).toBe(false);
    expect(interState).toBe(true);
    expect(totals.igst).toBe(totals.tax);
  });

  it("recovers the store default rate for lines without their own rate", () => {
    const order = pricedOrder({ items: [item({ gstRatePercent: null, lineTotal: 1000 }), item({ gstRatePercent: 12, lineTotal: 500 })], shippingCharges: 80, defaultRate: 18 });
    const { lines } = buildInvoiceTax(order, { sellerGstin: "33ABCDE1234F1Z5" });
    expect(lines.map((line) => line.rate)).toEqual([18, 12, 18]);
  });

  it("always adds up to the amount charged, using a round-off line", () => {
    const order = pricedOrder({
      items: Array.from({ length: 7 }, (_, index) => item({ lineTotal: 1000.33 + index * 7.77, gstRatePercent: index % 2 ? 12 : 5 })),
      shippingCharges: 99.99,
    });
    const { totals } = buildInvoiceTax(order, { sellerGstin: "33ABCDE1234F1Z5" });
    expect(totals.taxable - totals.discount + totals.tax + totals.roundOff).toBeCloseTo(order.totalAmount, 2);
    expect(Math.abs(totals.roundOff)).toBeLessThan(0.1);
  });
});

describe("invoice document", () => {
  const tenant = {
    name: "Norosilk",
    primaryDomain: "norosilk.test",
    branding: { siteTitle: "Norosilk", logoUrl: "", theme: { brand: "#6863ed" } },
    contact: { email: "orders@norosilk.test", phone: "+91 98400 12345", address: "Kanchipuram" },
    business: { legalName: "Norosilk Textiles Pvt Ltd", gstin: "33ABCDE1234F1Z5", registeredAddress: "", invoicePrefix: "INV" },
  };

  it("builds a GST tax invoice model", () => {
    const model = buildInvoiceModel({ order: pricedOrder({ items: [item()] }), payment: null, customer: null, tenant, origin: "https://norosilk.test" });
    expect(model.title).toBe("Tax invoice");
    expect(model.number).toBe("INV-NS-1001");
    expect(model.meta).toContainEqual(["Place of supply", "Tamil Nadu (33)"]);
    expect(model.status.text).toBe("PAID");
    expect(model.settlement[1]).toEqual(["Balance due", "0.00", true]);
  });

  it("is a plain invoice when the store has no GSTIN", () => {
    const model = buildInvoiceModel({
      order: pricedOrder({ items: [item()] }),
      payment: null,
      customer: null,
      tenant: { ...tenant, business: { ...tenant.business, gstin: "" } },
      origin: "https://norosilk.test",
    });
    expect(model.title).toBe("Invoice");
    expect(model.meta.map(([name]) => name)).not.toContain("Reverse charge");
  });

  it("renders a multi-page PDF for long orders", async () => {
    const order = pricedOrder({ items: Array.from({ length: 40 }, (_, index) => item({ productName: `Saree ${index + 1}` })) });
    const pdf = await renderInvoicePdf(buildInvoiceModel({ order, payment: null, customer: null, tenant, origin: "https://norosilk.test" }));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
  });
});
