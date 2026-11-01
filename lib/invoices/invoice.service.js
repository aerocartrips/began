import { createPdfDocument } from "@/lib/invoices/pdfkit-document";
import { Order } from "@/lib/db/models/Order";
import { Payment } from "@/lib/db/models/Payment";
import { User } from "@/lib/db/models/User";
import { ApiError } from "@/lib/utils/api-error";
import { PAYMENT_STATUS } from "@/lib/constants/order-status";
import { buildInvoiceNumber } from "@/lib/invoices/invoice-number";

function businessProfile() {
  return {
    name: process.env.NEXT_PUBLIC_BUSINESS_NAME?.trim() || "Norosilk",
    address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS?.trim() || "",
    email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL?.trim() || "",
    phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE?.trim() || "",
    gstin: process.env.BUSINESS_GSTIN?.trim() || "",
  };
}

function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

/**
 * @param {import("mongoose").Document} order
 * @param {Record<string, unknown> | null} payment
 * @param {Record<string, unknown> | null} customer
 */
function renderInvoicePdf(order, payment, customer) {
  const business = businessProfile();
  const doc = createPdfDocument({ margin: 48, size: "A4" });
  /** @type {Buffer[]} */
  const chunks = [];

  return new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const invoiceNumber = buildInvoiceNumber(order);
      const issuedAt = order.invoice?.issuedAt ?? new Date();

      doc.fontSize(18).text(business.name, { continued: false });
      doc.fontSize(10).fillColor("#444");
      if (business.address) doc.text(business.address);
      if (business.email) doc.text(business.email);
      if (business.phone) doc.text(business.phone);
      if (business.gstin) doc.text(`GSTIN: ${business.gstin}`);
      doc.moveDown();

      doc.fillColor("#000").fontSize(14).text("Tax Invoice / Order Statement", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`Invoice No: ${invoiceNumber}`);
      doc.text(`Invoice Date: ${new Date(issuedAt).toLocaleDateString("en-IN")}`);
      doc.text(`Order No: ${order.orderNumber}`);
      doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`);
      doc.moveDown();

      doc.text("Bill To:");
      const billingCompany = order.billingAddress?.companyName ?? customer?.companyName;
      const billingGstin = order.billingAddress?.gstin ?? customer?.gstNumber;
      doc.text(order.billingAddress?.fullName || customer?.name || "Customer");
      if (billingCompany) doc.text(billingCompany);
      if (billingGstin) doc.text(`GSTIN: ${billingGstin}`);
      doc.text(order.billingAddress?.addressLine1 || "");
      if (order.billingAddress?.addressLine2) doc.text(order.billingAddress.addressLine2);
      doc.text(
        `${order.billingAddress?.city || ""}, ${order.billingAddress?.state || ""} ${order.billingAddress?.pincode || ""}`,
      );
      doc.text(order.billingAddress?.phone || "");
      doc.moveDown();

      doc.text("Ship To:");
      doc.text(order.shippingAddress?.fullName || "");
      doc.text(order.shippingAddress?.addressLine1 || "");
      if (order.shippingAddress?.addressLine2) doc.text(order.shippingAddress.addressLine2);
      if (order.shippingAddress?.landmark) doc.text(`Landmark: ${order.shippingAddress.landmark}`);
      doc.text(
        `${order.shippingAddress?.city || ""}, ${order.shippingAddress?.state || ""} ${order.shippingAddress?.pincode || ""}`,
      );
      doc.moveDown();

      doc.fontSize(11).text("Line items", { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(9);
      for (const item of order.items ?? []) {
        doc.text(
          `${item.productName} (${item.sku}) — Qty ${item.quantity} × ₹${formatMoney(item.unitPrice)} = ₹${formatMoney(item.lineTotal)}`,
        );
      }
      doc.moveDown();

      doc.fontSize(10);
      doc.text(`Subtotal: ₹${formatMoney(order.subtotal)}`);
      doc.text(`Discount: ₹${formatMoney(order.discount)}`);
      doc.text(`Shipping: ₹${formatMoney(order.shippingCharges)}`);
      doc.text(`Tax/GST: ₹${formatMoney(order.tax)}`);
      doc.fontSize(12).text(`Total: ₹${formatMoney(order.totalAmount)}`, { underline: true });
      doc.moveDown();

      doc.fontSize(10);
      doc.text(`Payment status: ${order.paymentStatus}`);
      if (payment?.razorpayPaymentId) doc.text(`Payment reference: ${payment.razorpayPaymentId}`);
      if (payment?.capturedAt) doc.text(`Paid on: ${new Date(payment.capturedAt).toLocaleString("en-IN")}`);

      if (!business.gstin) {
        doc.moveDown();
        doc.fillColor("#666").fontSize(8).text(
          "This document is an order statement for wholesale records. Configure BUSINESS_GSTIN for GST tax invoice formatting.",
        );
      }

      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
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

  if (!order.invoice?.number) {
    order.invoice = {
      number: buildInvoiceNumber(order),
      issuedAt: new Date(),
    };
    await order.save();
  }

  const [payment, customer] = await Promise.all([
    Payment.findOne({ order: order._id }).sort({ createdAt: -1 }).lean(),
    User.findById(order.customer).select("name companyName gstNumber email").lean(),
  ]);

  const pdfBuffer = await renderInvoicePdf(order, payment, customer);
  return {
    buffer: pdfBuffer,
    filename: `${order.invoice.number}.pdf`,
    invoiceNumber: order.invoice.number,
  };
}
