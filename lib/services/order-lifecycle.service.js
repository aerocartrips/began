import { ApiError } from "@/lib/utils/api-error";
import { withTransaction } from "@/lib/db/transaction";
import { Order } from "@/lib/db/models/Order";
import { ORDER_STATUS, PAYMENT_STATUS, SETTLED_PAYMENT_STATUSES, STATUS_CHANGE_SOURCE } from "@/lib/constants/order-status";
import { FULFILLMENT_TRANSITIONS } from "@/lib/constants/order-transitions";
import { allocateInvoiceNumber } from "@/lib/invoices/invoice-number";
import { appendOrderStatusHistory } from "@/lib/services/order-status.service";
import {
  isOutOfStockError,
  releaseOrderStock,
  reserveStock,
  STOCK_MOVEMENT_REASON,
} from "@/lib/services/inventory.service";
import { initiateCancellationRefund } from "@/lib/services/refund.service";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { getActiveTenant } from "@/lib/tenant/active";
import { runAfterResponse } from "@/lib/utils/background";
import {
  onOrderStatusChanged,
  onPaymentCaptured,
  onPaymentFailed,
  onPaymentIssue,
  onStockReserved,
} from "@/lib/notifications/events";

/**
 * The order state machine for everything that moves money or stock: payment
 * confirmation (verify API, webhook, reconciliation, manual), cancellation
 * (customer, admin, payment expiry, a checkout that could not start) and the
 * stock, invoice and refund side effects that belong to each.
 *
 * Every transition reads the order inside a transaction, checks it is still in
 * a state the transition applies to, and writes the new state together with
 * its stock movements. Concurrent handlers for the same order (a webhook racing
 * the verify call or the expiry job) therefore serialise: one wins, the others
 * see the result and do nothing. Notifications, emails and refunds run only
 * after the transaction has committed.
 */

const SETTLED_PAYMENT = new Set(SETTLED_PAYMENT_STATUSES);
/** Fulfilment states that a confirmed payment moves to CONFIRMED. */
const AWAITING_PAYMENT = new Set([ORDER_STATUS.PENDING, ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.CANCELLED]);

/**
 * @typedef {import("mongoose").Document & Record<string, any>} OrderDocument
 * @typedef {{ _id?: unknown, email?: string, name?: string } | null | undefined} Actor
 * @typedef {"confirmed" | "reinstated" | "already_paid" | "refund_required"} PaymentOutcome
 */

const labelOf = (actor, fallback) => actor?.email ?? actor?.name ?? fallback;

/* ------------------------------------------------------------------ payment */

/**
 * Marks an order paid once the payment is verified with Razorpay (or recorded
 * by an admin for an offline payment). Idempotent: an order already paid is
 * returned unchanged.
 *
 * A payment can arrive after the order was cancelled (the shopper retried in
 * the Razorpay window after a failed attempt, or paid just as the reservation
 * expired). The order is then reinstated if its stock can still be held, and
 * otherwise kept cancelled with a full refund started.
 * @param {unknown} orderId
 * @param {{ method?: string, source?: string, actor?: Actor, remarks?: string, razorpayOrderId?: string }} [meta]
 * @returns {Promise<{ order: OrderDocument, outcome: PaymentOutcome }>}
 */
export async function confirmOrderPayment(orderId, meta = {}) {
  const { business } = await getActiveTenant();
  const source = meta.source ?? STATUS_CHANGE_SOURCE.PAYMENT;
  let result;
  try {
    result = await withTransaction(async (session) => {
      const order = await loadOrder(orderId, session);
      if (SETTLED_PAYMENT.has(order.paymentStatus)) return { order, outcome: "already_paid", stockChanges: [] };

      const reinstating = order.orderStatus === ORDER_STATUS.CANCELLED;
      // A cancellation someone chose (customer or store) stands and the money goes back.
      // Only system cancellations (payment expiry, a checkout that failed to start) are reinstated.
      if (reinstating && order.cancellation?.cancelledBy) return keepPaidOrderCancelled(order, session, meta, "cancelled");

      const stockChanges = reinstating && !order.inventoryReserved
        ? await reserveStock(order.items, { session, order: order._id, reason: STOCK_MOVEMENT_REASON.ORDER_REINSTATED })
        : [];
      if (stockChanges.length) order.inventoryReserved = true;

      const now = new Date();
      const previousOrderStatus = order.orderStatus;
      const previousPaymentStatus = order.paymentStatus;
      order.paymentStatus = PAYMENT_STATUS.PAID;
      if (AWAITING_PAYMENT.has(order.orderStatus)) order.orderStatus = ORDER_STATUS.CONFIRMED;
      order.paymentExpiresAt = null;
      if (meta.method) order.paymentMethod = meta.method;
      if (reinstating) order.cancellation = { reason: "", cancelledAt: null, cancelledBy: null };
      if (!order.invoice?.number) {
        // Invoices are numbered when the sale is recorded, in sequence, never at download time.
        order.invoice = { number: await allocateInvoiceNumber({ prefix: business.invoicePrefix, at: now, session }), issuedAt: now };
      }
      appendOrderStatusHistory(order, {
        previousOrderStatus,
        newOrderStatus: order.orderStatus,
        previousPaymentStatus,
        newPaymentStatus: order.paymentStatus,
        changedBy: meta.actor?._id ?? null,
        changedByLabel: labelOf(meta.actor, source),
        source,
        remarks: meta.remarks || (reinstating ? "Payment captured after the order was cancelled; order reinstated." : ""),
        customerVisibleRemark: "Payment received. Your order is confirmed.",
      });
      await order.save({ session });
      return { order, outcome: reinstating ? "reinstated" : "confirmed", stockChanges };
    });
  } catch (error) {
    if (!isOutOfStockError(error)) throw error;
    // The reinstatement rolled back: the stock has been sold since the order was cancelled.
    result = await withTransaction(async (session) => {
      const order = await loadOrder(orderId, session);
      return SETTLED_PAYMENT.has(order.paymentStatus)
        ? { order, outcome: "already_paid", stockChanges: [] }
        : keepPaidOrderCancelled(order, session, meta, "out_of_stock");
    });
  }

  await afterPayment(result, meta);
  return { order: result.order, outcome: result.outcome };
}

const PAID_WHILE_CANCELLED = {
  cancelled: {
    remarks: "Payment captured for an order that had been cancelled. Full refund started.",
    customerVisibleRemark: "We received a payment for this cancelled order, so we are refunding the full amount.",
  },
  out_of_stock: {
    remarks: "Payment captured after the order was cancelled, but the stock was no longer available. Full refund started.",
    customerVisibleRemark: "We received your payment after this order was cancelled. The items are no longer available, so we are refunding the full amount.",
  },
};

/**
 * Records money received for an order that stays cancelled, so the refund can
 * be issued and reconciled against it.
 * @param {OrderDocument} order read in `session`
 * @param {import("mongoose").ClientSession} session
 * @param {{ method?: string }} meta
 * @param {keyof typeof PAID_WHILE_CANCELLED} why
 */
async function keepPaidOrderCancelled(order, session, meta, why) {
  const copy = PAID_WHILE_CANCELLED[why];
  const previousPaymentStatus = order.paymentStatus;
  order.paymentStatus = PAYMENT_STATUS.PAID;
  order.paymentExpiresAt = null;
  if (meta.method) order.paymentMethod = meta.method;
  order.cancellationRefund = { status: "pending", razorpayRefundId: "", updatedAt: new Date(), message: copy.customerVisibleRemark };
  appendOrderStatusHistory(order, {
    previousPaymentStatus,
    newPaymentStatus: PAYMENT_STATUS.PAID,
    source: STATUS_CHANGE_SOURCE.PAYMENT,
    changedByLabel: STATUS_CHANGE_SOURCE.PAYMENT,
    remarks: copy.remarks,
    customerVisibleRemark: copy.customerVisibleRemark,
  });
  await order.save({ session });
  return { order, outcome: /** @type {const} */ ("refund_required"), stockChanges: [] };
}

/**
 * @param {{ order: OrderDocument, outcome: PaymentOutcome, stockChanges: any[] }} result
 * @param {{ razorpayOrderId?: string }} meta
 */
async function afterPayment({ order, outcome, stockChanges }, meta) {
  if (outcome === "already_paid") return;

  if (outcome === "refund_required") {
    onPaymentIssue({
      razorpayOrderId: meta.razorpayOrderId ?? "",
      orderId: order._id,
      reason: `Order ${order.orderNumber} was paid after it was cancelled; a full refund was started automatically`,
    });
    await initiateCancellationRefund(order, { reason: "Payment received for a cancelled order" });
    return;
  }

  onPaymentCaptured(order);
  if (stockChanges.length) {
    const { commerce } = await getStoreSettingsDocument();
    onStockReserved(stockChanges, commerce.lowStockThreshold);
  }
  // Claim the confirmation email atomically so retries and racing handlers send it once.
  const claimed = await Order.updateOne(
    { _id: order._id, paymentConfirmedNotifiedAt: null },
    { $set: { paymentConfirmedNotifiedAt: new Date() } },
  );
  if (claimed.modifiedCount > 0) {
    const snapshot = typeof order.toObject === "function" ? order.toObject() : order;
    runAfterResponse("New order email", async () => {
      const { notifyNewOrder } = await import("@/lib/services/email.service");
      await notifyNewOrder(snapshot);
    });
  }
}

/* ------------------------------------------------------------- cancellation */

/**
 * Cancels an order and returns its held stock, in one transaction.
 * @param {unknown} orderId
 * @param {{
 *   source: string,
 *   actor?: Actor,
 *   reason: string,
 *   remarks?: string,
 *   customerVisibleRemark: string,
 *   assert?: (order: OrderDocument) => void,
 * }} options `reason` is shown to the customer; `remarks` stay internal. `assert`
 *   runs against the freshly read order and throws to refuse the cancellation.
 * @returns {Promise<{ order: OrderDocument, cancelled: boolean, previousStatus: string }>}
 *   `cancelled` is false when the order was already cancelled (nothing changed)
 */
async function cancelInTransaction(orderId, options) {
  return withTransaction(async (session) => {
    const order = await loadOrder(orderId, session);
    options.assert?.(order);
    const previousStatus = order.orderStatus;
    if (previousStatus === ORDER_STATUS.CANCELLED) return { order, cancelled: false, previousStatus };
    if (!FULFILLMENT_TRANSITIONS[previousStatus]?.includes(ORDER_STATUS.CANCELLED)) {
      throw new ApiError(409, "This order can no longer be cancelled.");
    }

    const previousPaymentStatus = order.paymentStatus;
    order.orderStatus = ORDER_STATUS.CANCELLED;
    if (order.paymentStatus === PAYMENT_STATUS.PENDING) order.paymentStatus = PAYMENT_STATUS.FAILED;
    order.paymentExpiresAt = null;
    order.cancellation = { reason: options.reason, cancelledAt: new Date(), cancelledBy: options.actor?._id ?? null };
    appendOrderStatusHistory(order, {
      previousOrderStatus: previousStatus,
      newOrderStatus: ORDER_STATUS.CANCELLED,
      previousPaymentStatus,
      newPaymentStatus: order.paymentStatus,
      changedBy: options.actor?._id ?? null,
      changedByLabel: labelOf(options.actor, options.source),
      source: options.source,
      remarks: options.remarks ?? options.reason,
      customerVisibleRemark: options.customerVisibleRemark,
    });
    await order.save({ session });
    if (await releaseOrderStock(order._id, { session, actor: options.actor?._id ?? null })) {
      order.inventoryReserved = false;
    }
    return { order, cancelled: true, previousStatus };
  });
}

/**
 * Customer cancellation. `assert` carries the customer rules (ownership, stage,
 * cancellation window); a paid order is refunded in full.
 * @param {unknown} orderId
 * @param {NonNullable<Actor>} customer
 * @param {{ reason: string, assert: (order: OrderDocument) => void }} options
 */
export async function cancelOrderForCustomer(orderId, customer, { reason, assert }) {
  const result = await cancelInTransaction(orderId, {
    source: STATUS_CHANGE_SOURCE.CUSTOMER,
    actor: customer,
    reason,
    customerVisibleRemark: "Order cancelled by customer.",
    assert,
  });
  const refund = result.cancelled
    ? await initiateCancellationRefund(result.order, { reason: "Customer order cancellation", requestedBy: customer._id })
    : { status: result.order.cancellationRefund?.status ?? "none" };
  return { ...result, refund };
}

/**
 * Store cancellation from the admin order page. The customer is told and a
 * paid order is refunded in full; `remarks` stay internal.
 * @param {unknown} orderId
 * @param {NonNullable<Actor>} admin
 * @param {{ remarks?: string, customerVisibleRemark?: string }} [options]
 */
export async function cancelOrderForStore(orderId, admin, { remarks = "", customerVisibleRemark = "" } = {}) {
  const visible = customerVisibleRemark || "Your order was cancelled by the store.";
  const result = await cancelInTransaction(orderId, {
    source: STATUS_CHANGE_SOURCE.ADMIN,
    actor: admin,
    reason: visible,
    remarks: remarks || "Cancelled by the store.",
    customerVisibleRemark: visible,
  });
  if (!result.cancelled) return { ...result, refund: { status: result.order.cancellationRefund?.status ?? "none" } };

  onOrderStatusChanged(result.order, result.previousStatus, { source: STATUS_CHANGE_SOURCE.ADMIN, remark: customerVisibleRemark });
  const refund = await initiateCancellationRefund(result.order, { reason: "Order cancelled by the store", requestedBy: admin._id });
  return { ...result, refund };
}

/**
 * Payment window over with no payment: cancels the order, frees its stock and
 * tells the customer. A no-op for an order that is no longer awaiting payment.
 * @param {unknown} orderId
 */
export async function expireUnpaidOrder(orderId) {
  let stale = false;
  const result = await cancelInTransaction(orderId, {
    source: STATUS_CHANGE_SOURCE.SYSTEM,
    reason: "Payment was not received in time.",
    remarks: "Payment reservation expired.",
    customerVisibleRemark: "Payment was not received in time, so the order was cancelled. No amount was charged.",
    assert: (order) => {
      stale = order.paymentStatus !== PAYMENT_STATUS.PENDING || order.orderStatus !== ORDER_STATUS.PENDING_PAYMENT;
      if (stale) throw new StaleOrderError();
    },
  }).catch((error) => {
    if (error instanceof StaleOrderError) return null;
    throw error;
  });
  if (!result?.cancelled) return { cancelled: false, stale };
  onPaymentFailed(result.order, { expired: true });
  return { cancelled: true, stale: false };
}

/**
 * The payment could not be started for a just-created order (Razorpay error):
 * the order is cancelled at once so its stock is not held until expiry.
 * @param {unknown} orderId
 */
export async function abandonUnstartedCheckout(orderId) {
  await cancelInTransaction(orderId, {
    source: STATUS_CHANGE_SOURCE.SYSTEM,
    reason: "The payment could not be started.",
    customerVisibleRemark: "We could not start the payment, so this order was cancelled. No amount was charged.",
  });
}

class StaleOrderError extends Error {}

/**
 * @param {unknown} orderId
 * @param {import("mongoose").ClientSession} session
 * @returns {Promise<OrderDocument>}
 */
async function loadOrder(orderId, session) {
  const order = await Order.findById(orderId).session(session);
  if (!order) throw new ApiError(404, "Order not found.");
  return order;
}
