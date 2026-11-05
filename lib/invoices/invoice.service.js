import { Order } from "@/lib/db/models/Order";
import { Payment } from "@/lib/db/models/Payment";
import { User } from "@/lib/db/models/User";
import { ApiError } from "@/lib/utils/api-error";
import { PAYMENT_STATUS } from "@/lib/constants/order-status";
import { buildInvoiceNumber } from "@/lib/invoices/invoice-number";
import { buildInvoiceTax, stateCodeForName, stateCodeFromGstin, stateNameForCode } from "@/lib/invoices/gst";
import { formatMoney, renderInvoicePdf } from "@/lib/invoices/invoice-pdf";
import { loadInvoiceLogo } from "@/lib/invoices/invoice-logo";
import { getActiveTenant, getStoreOrigin } from "@/lib/tenant/active";

/** Invoices are dated in Indian Standard Time, whatever the server's zone. */
const DATE = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const DATE_TIME = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

const STATUS_STAMPS = {
  [PAYMENT_STATUS.PAID]: { text: "PAID", color: "#1f7a5a", background: "#e2f4ec" },
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: { text: "PARTIALLY REFUNDED", color: "#8a5a12", background: "#fcf0da" },
  [PAYMENT_STATUS.REFUNDED]: { text: "REFUNDED", color: "#8a5a12", background: "#fcf0da" },
  [PAYMENT_STATUS.FAILED]: { text: "PAYMENT FAILED", color: "#a3243a", background: "#fce6ea" },
  [PAYMENT_STATUS.PENDING]: { text: "PAYMENT DUE", color: "#8a5a12", background: "#fcf0da" },
};

const PAYMENT_METHODS = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  wallet: "Wallet",
  emi: "EMI",
  paylater: "Pay later",
  bank_transfer: "Bank transfer",
};

const SETTLED = new Set([PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED]);

const humanize = (value) => String(value ?? "").replace(/_/g, " ").replace(/^\w/, (first) => first.toUpperCase());
const formatDate = (value) => (value ? DATE.format(new Date(value)) : "");
/** Keeps a phone number on one line (non-breaking spaces). */
const unbroken = (value) => String(value ?? "").replace(/ /g, String.fromCharCode(160));

function addressLines(address = {}) {
  const cityLine = [address.city, address.pincode].filter(Boolean).join(" - ");
  return [
    address.addressLine1,
    address.addressLine2,
    address.landmark ? `Landmark: ${address.landmark}` : "",
    [cityLine, address.state, address.country].filter(Boolean).join(", "),
  ].filter(Boolean);
}

function paymentMethodLabel(order, payment) {
  const method = PAYMENT_METHODS[payment?.method] ?? (payment?.method ? humanize(payment.method) : "");
  if (order.paymentMethod === "razorpay") return method ? `${method} via Razorpay` : "Razorpay";
  return method || humanize(order.paymentMethod);
}

/**
 * Everything the invoice shows, as plain data (no database or PDF access), so
 * the figures can be tested on their own.
 * @param {{ order: any, payment: any, customer: any, tenant: import("@/lib/tenant/types").PublicTenant, origin: string, logo?: Buffer | null }} input
 */
export function buildInvoiceModel({ order, payment, customer, tenant, origin, logo = null }) {
  const { business, contact, branding } = tenant;
  const isTaxInvoice = Boolean(business.gstin);
  const number = buildInvoiceNumber(order, business.invoicePrefix);
  const tax = buildInvoiceTax(order, { sellerGstin: business.gstin });
  const sellerStateCode = stateCodeFromGstin(business.gstin);
  const billing = order.billingAddress ?? {};
  const shipping = order.shippingAddress ?? {};
  const total = tax.totals.grandTotal;
  const amountPaid = SETTLED.has(order.paymentStatus) ? total : 0;
  const site = origin.replace(/^https?:\/\//, "");
  const placeOfSupply = tax.placeOfSupply.name
    ? `${tax.placeOfSupply.name}${tax.placeOfSupply.code ? ` (${tax.placeOfSupply.code})` : ""}`
    : "—";

  const notes = [
    isTaxInvoice
      ? "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
      : "The seller's GSTIN is not set up yet, so this is an invoice for your records, not a GST tax invoice for input tax credit.",
    [`Returns and refunds: ${site}/returns`, contact.email || contact.phone ? `Questions: ${[contact.email, unbroken(contact.phone)].filter(Boolean).join(", ")}` : ""]
      .filter(Boolean)
      .join(".  "),
  ].filter(Boolean);

  return {
    number,
    orderNumber: order.orderNumber,
    title: isTaxInvoice ? "Tax invoice" : "Invoice",
    copyLabel: "Original for recipient",
    status: STATUS_STAMPS[order.paymentStatus] ?? STATUS_STAMPS[PAYMENT_STATUS.PENDING],
    meta: [
      ["Invoice no.", number],
      ["Invoice date", formatDate(order.invoice?.issuedAt ?? new Date())],
      ["Order no.", order.orderNumber],
      ["Order date", formatDate(order.createdAt)],
      ["Place of supply", placeOfSupply],
      ...(isTaxInvoice ? [["Reverse charge", "No"]] : []),
    ],
    seller: {
      displayName: branding.siteTitle || tenant.name,
      legalName: business.legalName || tenant.name,
      addressLines: String(business.registeredAddress || contact.address || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      gstin: business.gstin,
      stateCode: sellerStateCode,
      stateName: sellerStateCode ? stateNameForCode(sellerStateCode) : "",
      email: contact.email,
      phone: unbroken(contact.phone),
      website: site,
      brand: branding.theme?.brand || "#6863ed",
      logo,
    },
    billTo: {
      name: billing.fullName || customer?.name || "Customer",
      company: billing.companyName ?? customer?.companyName ?? "",
      gstin: billing.gstin ?? customer?.gstNumber ?? "",
      addressLines: addressLines(billing),
      state: billing.state,
      stateCode: stateCodeForName(billing.state),
      phone: unbroken(billing.phone),
      email: customer?.email ?? "",
    },
    shipTo: {
      name: shipping.fullName || billing.fullName || "",
      company: "",
      gstin: "",
      addressLines: addressLines(shipping),
      state: shipping.state,
      stateCode: stateCodeForName(shipping.state),
      phone: unbroken(shipping.phone),
      email: "",
    },
    tax,
    settlement: [
      ["Amount paid", formatMoney(amountPaid)],
      ["Balance due", formatMoney(total - amountPaid), true],
    ],
    // The payment status is the stamp in the header.
    payment: [
      ["Method", [paymentMethodLabel(order, payment), payment?.capturedAt ? `paid ${DATE_TIME.format(new Date(payment.capturedAt))}` : ""].filter(Boolean).join(", ")],
      ["Transaction ID", payment?.razorpayPaymentId ?? ""],
    ],
    notes,
  };
}

export async function getOrCreateOrderInvoice(orderId, { userId, isAdmin = false }) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");

  if (!isAdmin && String(order.customer) !== String(userId)) {
    throw new ApiError(403, "You do not have access to this invoice.");
  }

  if (order.paymentStatus === PAYMENT_STATUS.PENDING && !isAdmin) {
    throw new ApiError(409, "Invoice is available after payment is confirmed.");
  }

  const tenant = await getActiveTenant();
  if (!order.invoice?.number) {
    order.invoice = {
      number: buildInvoiceNumber(order, tenant.business.invoicePrefix),
      issuedAt: new Date(),
    };
    await order.save();
  }

  const [payment, customer, origin, logo] = await Promise.all([
    Payment.findOne({ order: order._id }).sort({ createdAt: -1 }).lean(),
    User.findById(order.customer).select("name companyName gstNumber email").lean(),
    getStoreOrigin(),
    loadInvoiceLogo(tenant.branding.logoUrl),
  ]);

  const pdfBuffer = await renderInvoicePdf(buildInvoiceModel({ order, payment, customer, tenant, origin, logo }));
  return {
    buffer: pdfBuffer,
    filename: `${order.invoice.number}.pdf`,
    invoiceNumber: order.invoice.number,
  };
}
