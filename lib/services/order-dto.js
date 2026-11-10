import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { customerOrderActions } from "@/lib/services/order-policy";

/**
 * What a customer may see of an order. The Order document also carries store-
 * only data (internal notes, staff remarks and who made each change, courier
 * booking payloads), so customer responses are built field by field from an
 * allow-list instead of serialising the document. Admin routes return the
 * document itself.
 */

const plain = (doc) => (doc && typeof doc.toObject === "function" ? doc.toObject() : doc);
const idOf = (value) => (value ? String(value._id ?? value) : null);

const ADDRESS_FIELDS = ["fullName", "phone", "addressLine1", "addressLine2", "landmark", "city", "state", "pincode", "country", "companyName", "gstin"];

function address(source = {}) {
  return Object.fromEntries(ADDRESS_FIELDS.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

function item(line) {
  return {
    product: idOf(line.product),
    variantId: idOf(line.variantId),
    productName: line.productName,
    sku: line.sku,
    colorName: line.colorName ?? "",
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    gstRatePercent: line.gstRatePercent ?? null,
    hsnCode: line.hsnCode ?? "",
    imageUrl: line.imageUrl ?? "",
  };
}

function shipment(source) {
  if (!source?.awb) return null;
  return {
    carrier: source.carrier ?? "",
    awb: source.awb,
    lrNumber: source.lrNumber ?? "",
    status: source.status ?? "",
    estimatedDelivery: source.estimatedDelivery ?? null,
    trackingFetchedAt: source.trackingFetchedAt ?? null,
  };
}

/**
 * Order as listed on the customer's orders page.
 * @param {Record<string, any>} order document or lean object
 */
export function toCustomerOrderSummary(order) {
  const source = plain(order);
  return {
    _id: String(source._id),
    orderNumber: source.orderNumber,
    orderStatus: source.orderStatus,
    paymentStatus: source.paymentStatus,
    totalAmount: source.totalAmount,
    currency: source.currency ?? "INR",
    createdAt: source.createdAt,
    items: (source.items ?? []).map(item),
    shipment: shipment(source.shipment),
  };
}

/**
 * Full order for the customer's order page, with what they may still do with
 * it (`actions`, from the store's cancellation and return windows).
 * @param {Record<string, any>} order document or lean object
 * @param {{ cancellationWindowHours: number, returnWindowDays: number }} windows StoreSettings.orders
 */
export function toCustomerOrder(order, windows) {
  const source = plain(order);
  return {
    ...toCustomerOrderSummary(source),
    subtotal: source.subtotal,
    discount: source.discount,
    shippingCharges: source.shippingCharges,
    tax: source.tax,
    paymentMethod: source.paymentMethod,
    paymentExpiresAt: source.paymentExpiresAt ?? null,
    deliveredAt: source.deliveredAt ?? null,
    shippingAddress: address(source.shippingAddress),
    billingAddress: address(source.billingAddress),
    customerVisibleRemark: source.customerVisibleRemark ?? "",
    // The shopper's own note from checkout.
    notes: source.notes ?? "",
    // Each change with what the customer was told about it; staff remarks and names stay internal.
    statusHistory: (source.statusHistory ?? []).map((entry) => ({
      previousOrderStatus: entry.previousOrderStatus,
      newOrderStatus: entry.newOrderStatus,
      previousPaymentStatus: entry.previousPaymentStatus,
      newPaymentStatus: entry.newPaymentStatus,
      customerVisibleRemark: entry.customerVisibleRemark ?? "",
      createdAt: entry.createdAt,
    })),
    cancellation: source.cancellation?.cancelledAt
      ? { reason: source.cancellation.reason ?? "", cancelledAt: source.cancellation.cancelledAt }
      : null,
    returnRequest: source.returnRequest?.status && source.returnRequest.status !== "none"
      ? {
          status: source.returnRequest.status,
          reason: source.returnRequest.reason ?? "",
          remarks: source.returnRequest.remarks ?? "",
          requestedAt: source.returnRequest.requestedAt ?? null,
        }
      : null,
    cancellationRefund: source.cancellationRefund?.status && source.cancellationRefund.status !== "none"
      ? {
          status: source.cancellationRefund.status,
          message: source.cancellationRefund.message ?? "",
          updatedAt: source.cancellationRefund.updatedAt ?? null,
        }
      : null,
    invoice: source.invoice?.number ? { number: source.invoice.number, issuedAt: source.invoice.issuedAt ?? null } : null,
    actions: customerOrderActions(source, windows),
  };
}

/**
 * toCustomerOrder with the current store's cancellation and return windows.
 * @param {Record<string, any>} order
 */
export async function presentOrderToCustomer(order) {
  const { orders } = await getStoreSettingsDocument();
  return toCustomerOrder(order, orders);
}

/**
 * The order's payment as the customer sees it (no provider metadata, refund
 * internals or staff ids).
 * @param {Record<string, any> | null | undefined} payment
 */
export function toCustomerPayment(payment) {
  const source = plain(payment);
  if (!source) return null;
  return {
    razorpayOrderId: source.razorpayOrderId ?? "",
    razorpayPaymentId: source.razorpayPaymentId ?? "",
    amount: source.amount,
    currency: source.currency,
    status: source.status,
    method: source.method ?? "",
    capturedAt: source.capturedAt ?? null,
    failedAt: source.failedAt ?? null,
    refundStatus: source.refundStatus ?? "none",
    refundedAmount: source.refundedAmount ?? 0,
  };
}
