import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { ORDER_STATUS, PAYMENT_STATUS, STATUS_CHANGE_SOURCE } from "@/lib/constants/order-status";
import { MANUAL_PAYMENT_TRANSITIONS } from "@/lib/constants/order-transitions";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { Order } from "@/lib/db/models/Order";
import { withTransaction } from "@/lib/db/transaction";
import { orderRepository } from "@/lib/repositories/order.repository";
import { createOrderSchema } from "@/lib/validators/order.validator";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { generateOrderNumber, rupeesToPaise } from "@/lib/services/order-pricing";
import { priceCartItems } from "@/lib/services/cart-pricing.service";
import { getActiveTenant } from "@/lib/tenant/active";
import { listOrdersQuery, getOrderSummary } from "@/lib/services/order-query.service";
import { applyFulfillmentStatus, appendOrderStatusHistory } from "@/lib/services/order-status.service";
import { resolveSavedAddress } from "@/lib/services/address.service";
import { reserveStock } from "@/lib/services/inventory.service";
import { cancelOrderForStore, confirmOrderPayment } from "@/lib/services/order-lifecycle.service";
import { onOrderStatusChanged, onStockReserved } from "@/lib/notifications/events";
import { presentOrderToCustomer } from "@/lib/services/order-dto";
import { humanizeStatus } from "@/lib/format";

/** Copies only snapshot fields, so later address-book edits never reach the order. */
function mapAddress(address) {
  return {
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    landmark: address.landmark ?? "",
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country ?? "India",
  };
}

/**
 * Validates and prices a checkout: items at current prices, address snapshots
 * and a signature identifying this exact checkout.
 * @param {Record<string, any>} customer
 * @param {unknown} payload
 * @param {{ strict?: boolean }} [options] `strict: false` reports stock and MOQ
 *   problems in `issues` instead of throwing (see assertDraftPriceable)
 */
export async function buildOrderDraft(customer, payload, { strict = true } = {}) {
  const parsed = createOrderSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const { shippingAddressId, billingAddressId } = parsed.data;
  const shippingSource = shippingAddressId
    ? resolveSavedAddress(customer, shippingAddressId, "shippingAddressId")
    : parsed.data.shippingAddress;
  const billingSource = billingAddressId
    ? resolveSavedAddress(customer, billingAddressId, "billingAddressId")
    : parsed.data.billingAddress ?? shippingSource;

  const priced = await priceCartItems(parsed.data.items, { strict });
  const lineItems = priced.lines.map((line) => ({
    product: line.productId,
    variantId: line.variantId,
    productName: line.name,
    sku: line.sku,
    colorName: line.colorName,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    gstRatePercent: line.gstRatePercent,
    hsnCode: line.hsnCode,
    imageUrl: line.imageUrl,
  }));

  const { totals } = priced;
  // Business identity is frozen on the billing snapshot so invoices stay unchanged after profile edits.
  const billingAddress = {
    ...mapAddress(billingSource),
    companyName: customer.companyName ?? "",
    gstin: billingSource.gstin || customer.gstNumber || "",
  };
  const shippingAddress = mapAddress(shippingSource);
  const amountPaise = rupeesToPaise(totals.totalAmount);

  if (amountPaise < 100) {
    throw new ApiError(422, "Validation failed.", [
      { field: "items", message: "Order total must be at least INR 1.00." },
    ]);
  }

  return {
    parsed,
    lineItems,
    totals,
    billingAddress,
    shippingAddress,
    amountPaise,
    issues: priced.issues,
    signature: checkoutSignatureOf({ lineItems, totals, shippingAddress, billingAddress, notes: parsed.data.notes ?? "" }),
  };
}

/**
 * Throws the first pricing problem (availability, stock, minimum quantity) of a
 * draft built with `strict: false`, exactly as strict pricing would have.
 * @param {{ issues: { field: string, message: string }[] }} draft
 */
export function assertDraftPriceable(draft) {
  if (draft.issues.length) throw new ApiError(422, draft.issues[0].message, draft.issues);
}

/**
 * Identical cart, prices and addresses give the same signature, so a shopper
 * who closes the payment window and pays again resumes the order (and the stock
 * it already holds) instead of reserving the stock a second time.
 */
function checkoutSignatureOf({ lineItems, totals, shippingAddress, billingAddress, notes }) {
  const items = lineItems
    .map((line) => [String(line.product), String(line.variantId ?? ""), line.quantity, line.unitPrice].join(":"))
    .sort();
  const payload = JSON.stringify({ items, total: totals.totalAmount, shippingAddress, billingAddress, notes });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Creates the order and holds its stock in one transaction; the order waits for
 * payment until `paymentExpiresAt` (the store's reservation window).
 * @param {Record<string, any>} customer
 * @param {unknown} payload
 * @param {{ draft?: Awaited<ReturnType<typeof buildOrderDraft>> }} [options] a draft already built for this payload
 */
export async function createPendingPaymentOrder(customer, payload, { draft: prebuilt } = {}) {
  const [draft, settings, tenant] = await Promise.all([
    prebuilt ?? buildOrderDraft(customer, payload),
    getStoreSettingsDocument(),
    getActiveTenant(),
  ]);
  const paymentExpiresAt = new Date(Date.now() + settings.orders.paymentReservationMinutes * 60 * 1000);
  // Known before the insert so the stock ledger can point at the order.
  const orderId = new mongoose.Types.ObjectId();

  const { order, stockChanges } = await withTransaction(async (session) => {
    const changes = await reserveStock(draft.parsed.data.items, { session, order: orderId });
    const created = await orderRepository.create(
      {
        _id: orderId,
        orderNumber: generateOrderNumber(tenant.slug),
        customer: customer._id,
        items: draft.lineItems,
        shippingAddress: draft.shippingAddress,
        billingAddress: draft.billingAddress,
        subtotal: draft.totals.subtotal,
        discount: draft.totals.discount,
        shippingCharges: draft.totals.shippingCharges,
        tax: draft.totals.tax,
        totalAmount: draft.totals.totalAmount,
        amountPaise: draft.amountPaise,
        currency: "INR",
        paymentMethod: "razorpay",
        paymentStatus: PAYMENT_STATUS.PENDING,
        orderStatus: ORDER_STATUS.PENDING_PAYMENT,
        inventoryReserved: true,
        paymentExpiresAt,
        checkoutSignature: draft.signature,
        notes: draft.parsed.data.notes ?? "",
        statusHistory: [
          {
            previousOrderStatus: ORDER_STATUS.PENDING,
            newOrderStatus: ORDER_STATUS.PENDING_PAYMENT,
            previousPaymentStatus: PAYMENT_STATUS.PENDING,
            newPaymentStatus: PAYMENT_STATUS.PENDING,
            source: STATUS_CHANGE_SOURCE.SYSTEM,
            customerVisibleRemark: "Order created. Awaiting payment.",
          },
        ],
      },
      session,
    );
    return { order: created, stockChanges: changes };
  });

  onStockReserved(stockChanges, settings.commerce.lowStockThreshold);
  return order;
}

const ORDER_NUMBER = /^[A-Z0-9-]{6,40}$/;

/**
 * The customer's own order by its number, as the customer may see it (the
 * checkout confirmation); null for an unknown number or someone else's order.
 * @param {{ _id: unknown }} customer
 * @param {string} orderNumber
 */
export async function getCustomerOrderByNumber(customer, orderNumber) {
  const number = String(orderNumber ?? "").trim().toUpperCase();
  if (!ORDER_NUMBER.test(number)) return null;
  const order = await Order.findOne({ orderNumber: number, customer: customer._id }).lean();
  return order ? presentOrderToCustomer(order) : null;
}

export async function getOrderForUser(orderId, user, isAdmin) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (
    !isAdmin &&
    (!user || String(order.customer._id ?? order.customer) !== String(user._id))
  ) {
    throw new ApiError(403, "You do not have access to this order.");
  }
  return order;
}

export async function listOrders(user, searchParams, isAdmin) {
  return listOrdersQuery(user, searchParams, isAdmin);
}

export { getOrderSummary };

/**
 * Admin changes from the order page. Cancelling and recording a payment go
 * through the order lifecycle (stock, refund, invoice and notifications); the
 * remaining fields (fulfilment progress, AWB, notes) are applied in a
 * transaction so they never act on a stale order.
 * @param {string} orderId
 * @param {import("zod").infer<typeof import("@/lib/validators/order.validator").updateOrderStatusSchema>} payload
 * @param {Record<string, any> | null} actor
 */
export async function updateOrderStatus(orderId, payload, actor = null) {
  if (!mongoose.isValidObjectId(orderId)) throw new ApiError(404, "Order not found.");
  const cancelling = payload.orderStatus === ORDER_STATUS.CANCELLED;

  if (payload.paymentStatus) await recordManualPayment(orderId, payload.paymentStatus, actor, payload.remarks);
  if (cancelling) {
    await cancelOrderForStore(orderId, actor, { remarks: payload.remarks, customerVisibleRemark: payload.customerVisibleRemark });
  }

  const actorLabel = actor?.email ?? actor?.name ?? (actor?._id ? String(actor._id) : "admin");
  const meta = {
    actor: actor?._id,
    actorLabel,
    source: STATUS_CHANGE_SOURCE.ADMIN,
    customerVisibleRemark: payload.customerVisibleRemark,
  };
  // A remark already recorded with the cancellation or payment is not repeated.
  const remarks = cancelling || payload.paymentStatus ? "" : payload.remarks;

  const { order, previousOrderStatus } = await withTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new ApiError(404, "Order not found.");
    const previousOrderStatus = order.orderStatus;

    if (payload.internalNotes !== undefined) order.internalNotes = payload.internalNotes;
    if (payload.customerVisibleRemark !== undefined) order.customerVisibleRemark = payload.customerVisibleRemark;

    if (payload.shipmentAwb) {
      order.shipment = order.shipment ?? {};
      order.shipment.awb = payload.shipmentAwb;
      order.shipment.carrier = order.shipment.carrier || "Delhivery";
      order.shipment.createdAt = order.shipment.createdAt || new Date();
      if (payload.shipmentStatus) order.shipment.status = payload.shipmentStatus;
      if ([ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.PACKED].includes(order.orderStatus)) {
        applyFulfillmentStatus(order, ORDER_STATUS.SHIPPED, { ...meta, remarks: remarks || "Shipment AWB assigned." });
      }
    }

    if (payload.orderStatus && !cancelling && payload.orderStatus !== order.orderStatus) {
      applyFulfillmentStatus(order, payload.orderStatus, { ...meta, remarks });
    } else if (remarks) {
      appendOrderStatusHistory(order, {
        changedBy: actor?._id,
        changedByLabel: actorLabel,
        source: STATUS_CHANGE_SOURCE.ADMIN,
        remarks,
        customerVisibleRemark: payload.customerVisibleRemark,
      });
    }

    await order.save({ session });
    return { order, previousOrderStatus };
  });

  onOrderStatusChanged(order, previousOrderStatus, {
    source: STATUS_CHANGE_SOURCE.ADMIN,
    remark: payload.customerVisibleRemark,
  });
  return order.populate("customer", "name email companyName phone");
}

/**
 * Payment status set by hand: only an unpaid order can be marked paid (money
 * received outside Razorpay), which confirms it as an online payment would.
 * @param {string} orderId
 * @param {string} nextStatus
 * @param {Record<string, any> | null} actor
 * @param {string} [remarks]
 */
async function recordManualPayment(orderId, nextStatus, actor, remarks) {
  const current = await Order.findById(orderId).select("paymentStatus").lean();
  if (!current) throw new ApiError(404, "Order not found.");
  if (current.paymentStatus === nextStatus) return;
  if (!MANUAL_PAYMENT_TRANSITIONS[current.paymentStatus]?.includes(nextStatus)) {
    throw new ApiError(
      422,
      `Payment status cannot be changed from ${humanizeStatus(current.paymentStatus)} to ${humanizeStatus(nextStatus)} by hand. Payments and failures come from Razorpay; refunds are issued from the payment's refund action.`,
    );
  }
  await confirmOrderPayment(orderId, {
    source: STATUS_CHANGE_SOURCE.ADMIN,
    actor,
    remarks: remarks || "Payment received outside online checkout, recorded by the store.",
  });
}
