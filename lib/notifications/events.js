/**
 * Business event → notification mapping. Every handler is called by the owning
 * service only after its state change is committed, takes a plain snapshot of the
 * data it needs synchronously, and hands the writes to `dispatchNotification`, so
 * handlers never block or fail the business operation that triggered them.
 */
import {
  ADMIN_AUDIENCE,
  NOTIFICATION_ENTITY,
  NOTIFICATION_SEVERITY,
  NOTIFICATION_TYPE,
} from "@/lib/constants/notifications";
import { ORDER_STATUS, STATUS_CHANGE_SOURCE } from "@/lib/constants/order-status";
import { CUSTOMER_SUPPORT_STATUS } from "@/lib/constants/support";
import { dispatchNotification, notifyAdmins, notifyCustomer, notifyCustomers } from "@/lib/services/notification.service";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

/** @param {Record<string, any>} order */
function orderRef(order) {
  return {
    id: String(order._id),
    orderNumber: String(order.orderNumber ?? ""),
    customerId: String(order.customer?._id ?? order.customer ?? ""),
    totalAmount: Number(order.totalAmount ?? 0),
  };
}

const customerOrderUrl = (orderId) => `/account/orders/${orderId}`;
const adminOrderUrl = (orderId) => `/admin/orders/${orderId}`;

/** Customer-facing copy per fulfilment status. Statuses not listed do not notify. */
const ORDER_STATUS_COPY = {
  [ORDER_STATUS.CONFIRMED]: { title: "Order confirmed", message: (n) => `Your order ${n} is confirmed and queued for fulfilment.` },
  [ORDER_STATUS.PROCESSING]: { title: "Order in progress", message: (n) => `We have started preparing your order ${n}.` },
  [ORDER_STATUS.PACKED]: { title: "Order packed", message: (n) => `Your order ${n} is packed and ready for dispatch.` },
  [ORDER_STATUS.SHIPPED]: { title: "Order shipped", message: (n) => `Your order ${n} is on its way.`, severity: NOTIFICATION_SEVERITY.SUCCESS },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: { title: "Out for delivery", message: (n) => `Your order ${n} is out for delivery today.` },
  [ORDER_STATUS.DELIVERED]: { title: "Order delivered", message: (n) => `Your order ${n} has been delivered.`, severity: NOTIFICATION_SEVERITY.SUCCESS },
  [ORDER_STATUS.CANCELLED]: { title: "Order cancelled", message: (n) => `Your order ${n} has been cancelled.`, severity: NOTIFICATION_SEVERITY.WARNING },
  [ORDER_STATUS.RETURNED]: { title: "Return completed", message: (n) => `The return for order ${n} has been completed.` },
};

/** One notification per order and status, whichever source (admin or carrier) reports it first. */
function customerOrderStatusContent(ref, status, remark) {
  const copy = ORDER_STATUS_COPY[status];
  if (!copy) return null;
  return {
    type: NOTIFICATION_TYPE.ORDER_STATUS_CHANGED,
    severity: copy.severity ?? NOTIFICATION_SEVERITY.INFO,
    title: copy.title,
    message: remark ? `${copy.message(ref.orderNumber)} ${remark}` : copy.message(ref.orderNumber),
    entityType: NOTIFICATION_ENTITY.ORDER,
    entityId: ref.id,
    url: customerOrderUrl(ref.id),
    metadata: { orderNumber: ref.orderNumber, status },
    dedupeKey: `order:${ref.id}:status:${status}`,
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/** Payment verified against Razorpay and the order finalised (verify API, webhook or reconciliation). */
export function onPaymentCaptured(order) {
  const ref = orderRef(order);
  dispatchNotification("payment.captured", () =>
    Promise.all([
      notifyCustomer(ref.customerId, {
        type: NOTIFICATION_TYPE.PAYMENT_SUCCEEDED,
        severity: NOTIFICATION_SEVERITY.SUCCESS,
        title: "Payment received · order confirmed",
        message: `We received ${inr.format(ref.totalAmount)} for order ${ref.orderNumber}. Your order is confirmed.`,
        entityType: NOTIFICATION_ENTITY.ORDER,
        entityId: ref.id,
        url: customerOrderUrl(ref.id),
        metadata: { orderNumber: ref.orderNumber },
        dedupeKey: `order:${ref.id}:paid`,
      }),
      notifyAdmins(ADMIN_AUDIENCE.COMMERCE, {
        type: NOTIFICATION_TYPE.NEW_ORDER,
        severity: NOTIFICATION_SEVERITY.SUCCESS,
        title: `New paid order ${ref.orderNumber}`,
        message: `Payment of ${inr.format(ref.totalAmount)} captured. Ready for fulfilment.`,
        entityType: NOTIFICATION_ENTITY.ORDER,
        entityId: ref.id,
        url: adminOrderUrl(ref.id),
        metadata: { orderNumber: ref.orderNumber },
        dedupeKey: `order:${ref.id}:new`,
      }),
    ]),
  );
}

/**
 * Payment failure confirmed by Razorpay, or the payment window expired.
 * @param {Record<string, any>} order
 * @param {{ expired?: boolean }} [options]
 */
export function onPaymentFailed(order, { expired = false } = {}) {
  const ref = orderRef(order);
  dispatchNotification("payment.failed", () =>
    notifyCustomer(ref.customerId, {
      type: NOTIFICATION_TYPE.PAYMENT_FAILED,
      severity: NOTIFICATION_SEVERITY.WARNING,
      title: expired ? "Payment window expired" : "Payment not completed",
      message: `${expired ? "We did not receive payment in time" : "Your payment could not be completed"} for order ${ref.orderNumber}, so it was cancelled and no amount was charged. You can place the order again anytime.`,
      entityType: NOTIFICATION_ENTITY.ORDER,
      entityId: ref.id,
      url: customerOrderUrl(ref.id),
      metadata: { orderNumber: ref.orderNumber },
      dedupeKey: `order:${ref.id}:payment_failed`,
    }),
  );
}

/**
 * Verification or reconciliation found a mismatch that needs a human (amount, currency, order).
 * @param {{ razorpayOrderId: string; razorpayPaymentId?: string; orderId?: unknown; reason: string }} issue
 */
export function onPaymentIssue({ razorpayOrderId, razorpayPaymentId, orderId, reason }) {
  dispatchNotification("payment.issue", () =>
    notifyAdmins(ADMIN_AUDIENCE.FINANCE, {
      type: NOTIFICATION_TYPE.PAYMENT_ISSUE,
      severity: NOTIFICATION_SEVERITY.CRITICAL,
      title: "Payment verification issue",
      message: `${reason} (Razorpay order ${razorpayOrderId}). Reconcile before fulfilling.`,
      entityType: orderId ? NOTIFICATION_ENTITY.ORDER : NOTIFICATION_ENTITY.PAYMENT,
      entityId: orderId ? String(orderId) : razorpayOrderId,
      url: orderId ? adminOrderUrl(String(orderId)) : "/admin/payments",
      dedupeKey: `payment:${razorpayOrderId}:${razorpayPaymentId ?? "none"}:issue:${reason.slice(0, 60)}`,
    }),
  );
}

/** @param {{ eventId: string; eventType: string; reason: string }} event */
export function onWebhookProcessingFailed({ eventId, eventType, reason }) {
  dispatchNotification("webhook.failed", () =>
    notifyAdmins(ADMIN_AUDIENCE.FINANCE, {
      type: NOTIFICATION_TYPE.INTEGRATION_ERROR,
      severity: NOTIFICATION_SEVERITY.CRITICAL,
      title: "Razorpay webhook failed",
      message: `${eventType} could not be processed: ${reason}`,
      entityType: NOTIFICATION_ENTITY.WEBHOOK,
      entityId: eventId,
      url: "/admin/payments",
      dedupeKey: `webhook:${eventId}:failed`,
    }),
  );
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * Fulfilment status changed and was saved.
 * @param {Record<string, any>} order
 * @param {string} previousStatus
 * @param {{ source?: string; remark?: string }} [options]
 */
export function onOrderStatusChanged(order, previousStatus, { source, remark } = {}) {
  if (order.orderStatus === previousStatus) return;
  // Customers are not told about changes they made themselves.
  if (source === STATUS_CHANGE_SOURCE.CUSTOMER) return;
  const content = customerOrderStatusContent(orderRef(order), order.orderStatus, remark);
  if (!content) return;
  const customerId = orderRef(order).customerId;
  dispatchNotification("order.status_changed", () => notifyCustomer(customerId, content));
}

/**
 * @param {Record<string, any>} order
 * @param {{ requestId?: unknown; reason?: string; paid: boolean }} details
 */
export function onCustomerCancellation(order, { requestId, reason, paid }) {
  const ref = orderRef(order);
  dispatchNotification("order.cancelled_by_customer", () =>
    notifyAdmins(paid ? ADMIN_AUDIENCE.FINANCE : ADMIN_AUDIENCE.COMMERCE, {
      type: NOTIFICATION_TYPE.CANCELLATION_REQUESTED,
      severity: paid ? NOTIFICATION_SEVERITY.WARNING : NOTIFICATION_SEVERITY.INFO,
      title: `Order ${ref.orderNumber} cancelled by customer`,
      message: `${paid ? "Paid order — refund in progress. " : ""}${reason ? `Reason: ${reason}` : ""}`.trim(),
      entityType: requestId ? NOTIFICATION_ENTITY.SERVICE_REQUEST : NOTIFICATION_ENTITY.ORDER,
      entityId: requestId ? String(requestId) : ref.id,
      url: requestId ? `/admin/returns/${requestId}` : adminOrderUrl(ref.id),
      metadata: { orderNumber: ref.orderNumber },
      dedupeKey: `order:${ref.id}:customer_cancelled`,
    }),
  );
}

/**
 * @param {Record<string, any>} order
 * @param {{ requestId?: unknown; reason?: string }} details
 */
export function onReturnRequested(order, { requestId, reason }) {
  const ref = orderRef(order);
  const requestedAt = order.returnRequest?.requestedAt ? new Date(order.returnRequest.requestedAt).getTime() : 0;
  dispatchNotification("order.return_requested", () =>
    notifyAdmins(ADMIN_AUDIENCE.COMMERCE, {
      type: NOTIFICATION_TYPE.RETURN_REQUESTED,
      severity: NOTIFICATION_SEVERITY.WARNING,
      title: `Return requested for ${ref.orderNumber}`,
      message: reason ? `Reason: ${reason}` : "Review the return request.",
      entityType: requestId ? NOTIFICATION_ENTITY.SERVICE_REQUEST : NOTIFICATION_ENTITY.ORDER,
      entityId: requestId ? String(requestId) : ref.id,
      url: requestId ? `/admin/returns/${requestId}` : adminOrderUrl(ref.id),
      metadata: { orderNumber: ref.orderNumber },
      dedupeKey: `order:${ref.id}:return_requested:${requestedAt}`,
    }),
  );
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/**
 * @param {{ orderId: unknown; orderNumber: string; customerId: unknown; refundId: string; amountPaise: number }} refund
 */
export function onRefundInitiated({ orderId, orderNumber, customerId, refundId, amountPaise }) {
  dispatchNotification("refund.initiated", () =>
    notifyCustomer(customerId, {
      type: NOTIFICATION_TYPE.REFUND_INITIATED,
      title: "Refund initiated",
      message: `A refund of ${inr.format(amountPaise / 100)} for order ${orderNumber} has been initiated. It usually reaches your account in 5–7 business days.`,
      entityType: NOTIFICATION_ENTITY.ORDER,
      entityId: String(orderId),
      url: customerOrderUrl(String(orderId)),
      metadata: { orderNumber },
      dedupeKey: `refund:${refundId}:initiated`,
    }),
  );
}

/**
 * Final refund outcome confirmed by Razorpay webhook.
 * @param {{ orderId: unknown; orderNumber: string; customerId: unknown; refundId: string; amountPaise: number; succeeded: boolean }} refund
 */
export function onRefundSettled({ orderId, orderNumber, customerId, refundId, amountPaise, succeeded }) {
  const amount = inr.format(amountPaise / 100);
  dispatchNotification(succeeded ? "refund.processed" : "refund.failed", () =>
    Promise.all([
      notifyCustomer(customerId, {
        type: succeeded ? NOTIFICATION_TYPE.REFUND_COMPLETED : NOTIFICATION_TYPE.REFUND_FAILED,
        severity: succeeded ? NOTIFICATION_SEVERITY.SUCCESS : NOTIFICATION_SEVERITY.WARNING,
        title: succeeded ? "Refund completed" : "Refund could not be completed",
        message: succeeded
          ? `Your refund of ${amount} for order ${orderNumber} has been processed.`
          : `The refund of ${amount} for order ${orderNumber} did not go through. Our team is looking into it and will contact you.`,
        entityType: NOTIFICATION_ENTITY.ORDER,
        entityId: String(orderId),
        url: customerOrderUrl(String(orderId)),
        metadata: { orderNumber },
        dedupeKey: `refund:${refundId}:${succeeded ? "processed" : "failed"}`,
      }),
      succeeded
        ? null
        : notifyAdmins(ADMIN_AUDIENCE.FINANCE, {
            type: NOTIFICATION_TYPE.ADMIN_REFUND_FAILED,
            severity: NOTIFICATION_SEVERITY.CRITICAL,
            title: `Refund failed for ${orderNumber}`,
            message: `Razorpay reported refund ${refundId} (${amount}) as failed.`,
            entityType: NOTIFICATION_ENTITY.ORDER,
            entityId: String(orderId),
            url: adminOrderUrl(String(orderId)),
            dedupeKey: `refund:${refundId}:failed`,
          }),
    ]),
  );
}

/** An automatic cancellation refund could not be started; finance must act. */
export function onRefundStartFailed(order, reason) {
  const ref = orderRef(order);
  dispatchNotification("refund.start_failed", () =>
    notifyAdmins(ADMIN_AUDIENCE.FINANCE, {
      type: NOTIFICATION_TYPE.ADMIN_REFUND_FAILED,
      severity: NOTIFICATION_SEVERITY.CRITICAL,
      title: `Refund needs attention for ${ref.orderNumber}`,
      message: reason,
      entityType: NOTIFICATION_ENTITY.ORDER,
      entityId: ref.id,
      url: adminOrderUrl(ref.id),
      dedupeKey: `order:${ref.id}:refund_start_failed`,
    }),
  );
}

// ---------------------------------------------------------------------------
// Shipping
// ---------------------------------------------------------------------------

export function onShipmentBooked(order) {
  const ref = orderRef(order);
  const awb = order.shipment?.awb ?? "";
  dispatchNotification("shipment.booked", () =>
    notifyCustomer(ref.customerId, {
      type: NOTIFICATION_TYPE.SHIPMENT_BOOKED,
      title: "Shipment booked",
      message: `Order ${ref.orderNumber} has been handed to ${order.shipment?.carrier || "our courier"}${awb ? ` (AWB ${awb})` : ""}. Tracking is now available.`,
      entityType: NOTIFICATION_ENTITY.ORDER,
      entityId: ref.id,
      url: customerOrderUrl(ref.id),
      metadata: { orderNumber: ref.orderNumber },
      dedupeKey: `order:${ref.id}:shipment_booked`,
    }),
  );
}

/**
 * @param {Record<string, any>} order
 * @param {{ reconciliation: boolean; detail?: string }} failure
 */
export function onShipmentBookingFailed(order, { reconciliation, detail }) {
  const ref = orderRef(order);
  const attempt = order.shipment?.bookingAttempts?.length ?? 0;
  dispatchNotification("shipment.booking_failed", () =>
    notifyAdmins(ADMIN_AUDIENCE.OPERATIONS, {
      type: reconciliation ? NOTIFICATION_TYPE.SHIPMENT_RECONCILIATION : NOTIFICATION_TYPE.SHIPMENT_BOOKING_FAILED,
      severity: NOTIFICATION_SEVERITY.CRITICAL,
      title: reconciliation ? `Shipment for ${ref.orderNumber} needs reconciliation` : `Shipment booking failed for ${ref.orderNumber}`,
      message: reconciliation
        ? "The booking request was sent but the result is unknown. Check Delhivery before retrying."
        : `Delhivery rejected the booking${detail ? `: ${detail}` : "."}`,
      entityType: NOTIFICATION_ENTITY.ORDER,
      entityId: ref.id,
      url: adminOrderUrl(ref.id),
      dedupeKey: `order:${ref.id}:booking_failed:${attempt}`,
    }),
  );
}

export function onManifestFailed(order, detail) {
  const ref = orderRef(order);
  const hour = new Date().toISOString().slice(0, 13);
  dispatchNotification("shipment.manifest_failed", () =>
    notifyAdmins(ADMIN_AUDIENCE.OPERATIONS, {
      type: NOTIFICATION_TYPE.MANIFEST_FAILED,
      severity: NOTIFICATION_SEVERITY.WARNING,
      title: `Manifest failed for ${ref.orderNumber}`,
      message: detail ? `Delhivery: ${detail}` : "Manifest generation failed.",
      entityType: NOTIFICATION_ENTITY.ORDER,
      entityId: ref.id,
      url: adminOrderUrl(ref.id),
      dedupeKey: `order:${ref.id}:manifest_failed:${hour}`,
    }),
  );
}

/**
 * Maps a carrier status line to a customer milestone. "Undelivered"/"RTO" are
 * deliberately not milestones.
 * @param {string | null | undefined} carrierStatus
 */
export function carrierMilestone(carrierStatus) {
  const text = String(carrierStatus ?? "").toLowerCase();
  if (!text || /undeliver|not delivered|rto|return/.test(text)) return null;
  if (/out for delivery|dispatched for delivery/.test(text)) return ORDER_STATUS.OUT_FOR_DELIVERY;
  if (/\bdelivered\b/.test(text)) return ORDER_STATUS.DELIVERED;
  return null;
}

/** Fresh tracking data arrived from Delhivery. */
export function onTrackingUpdated(order, previousCarrierStatus) {
  const milestone = carrierMilestone(order.shipment?.status);
  if (!milestone || milestone === carrierMilestone(previousCarrierStatus)) return;
  const ref = orderRef(order);
  const content = customerOrderStatusContent(ref, milestone);
  if (content) dispatchNotification("shipment.tracking", () => notifyCustomer(ref.customerId, content));
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/**
 * Called after an order's stock reservation commits.
 * @param {{ productId: unknown; name: string; previousStock: number; stock: number }[]} changes
 */
/**
 * @param {{ productId: unknown, name: string, previousStock: number, stock: number }[]} changes
 * @param {number} lowStockThreshold the store's threshold (StoreSettings.commerce)
 */
export function onStockReserved(changes, lowStockThreshold) {
  const day = new Date().toISOString().slice(0, 10);
  const alerts = changes
    .map((change) => {
      const id = String(change.productId);
      if (change.stock <= 0) {
        return {
          type: NOTIFICATION_TYPE.OUT_OF_STOCK,
          severity: NOTIFICATION_SEVERITY.CRITICAL,
          title: `${change.name} is out of stock`,
          message: "Shoppers can no longer buy it. Restock to resume sales.",
          id,
          dedupeKey: `product:${id}:out_of_stock:${day}`,
        };
      }
      if (change.stock <= lowStockThreshold && change.previousStock > lowStockThreshold) {
        return {
          type: NOTIFICATION_TYPE.LOW_STOCK,
          severity: NOTIFICATION_SEVERITY.WARNING,
          title: `Low stock: ${change.name}`,
          message: `Only ${change.stock} left in stock.`,
          id,
          dedupeKey: `product:${id}:low_stock:${day}`,
        };
      }
      return null;
    })
    .filter(Boolean);

  if (!alerts.length) return;
  dispatchNotification("inventory.alert", () =>
    notifyAdmins(
      ADMIN_AUDIENCE.CATALOG,
      alerts.map(({ id, ...alert }) => ({
        ...alert,
        entityType: NOTIFICATION_ENTITY.PRODUCT,
        entityId: id,
        url: `/admin/products/${id}/edit`,
      })),
    ),
  );
}

/**
 * A product became orderable again; notify subscribed customers once.
 * @param {{ _id: unknown; name: string; slug: string }} product
 */
export function onProductBackInStock(product) {
  const productId = String(product._id);
  const { name, slug } = product;
  // Fixed outside the task so a retried dispatch reuses the same dedupe keys.
  const stamp = Date.now();
  dispatchNotification("inventory.back_in_stock", async () => {
    const { StockAlert } = await import("@/lib/db/models/StockAlert");
    const alerts = await StockAlert.find({ product: productId, notifiedAt: null }).select("customer").lean();
    if (!alerts.length) return;
    await notifyCustomers(
      alerts.map((alert) => alert.customer),
      () => ({
        type: NOTIFICATION_TYPE.BACK_IN_STOCK,
        severity: NOTIFICATION_SEVERITY.SUCCESS,
        title: `${name} is back in stock`,
        message: "The product you asked about can be ordered again.",
        entityType: NOTIFICATION_ENTITY.PRODUCT,
        entityId: productId,
        url: `/products/${slug}`,
        dedupeKey: `product:${productId}:back_in_stock:${stamp}`,
      }),
    );
    await StockAlert.updateMany({ _id: { $in: alerts.map((alert) => alert._id) } }, { $set: { notifiedAt: new Date() } });
  });
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

/** @param {Record<string, any>} conversation */
function conversationRef(conversation) {
  return {
    id: String(conversation._id ?? conversation.id),
    subject: String(conversation.subject ?? "Support conversation"),
    customerId: conversation.customer ? String(conversation.customer._id ?? conversation.customer) : null,
  };
}

export function onSupportConversationCreated(conversation, { preview = "", fromContactForm = false } = {}) {
  const ref = conversationRef(conversation);
  dispatchNotification("support.conversation_created", () =>
    notifyAdmins(ADMIN_AUDIENCE.SUPPORT, {
      type: NOTIFICATION_TYPE.SUPPORT_NEW_CONVERSATION,
      title: `New ${fromContactForm ? "contact message" : "support conversation"}: ${ref.subject}`,
      message: preview,
      entityType: NOTIFICATION_ENTITY.SUPPORT_CONVERSATION,
      entityId: ref.id,
      url: `/admin/messages/${ref.id}`,
      dedupeKey: `support:${ref.id}:created`,
    }),
  );
}

/** Several unread customer messages in one thread collapse into a single admin notification. */
export function onSupportCustomerMessage(conversation, preview) {
  const ref = conversationRef(conversation);
  dispatchNotification("support.customer_message", () =>
    notifyAdmins(ADMIN_AUDIENCE.SUPPORT, {
      type: NOTIFICATION_TYPE.SUPPORT_CUSTOMER_MESSAGE,
      title: `New message: ${ref.subject}`,
      message: preview,
      entityType: NOTIFICATION_ENTITY.SUPPORT_CONVERSATION,
      entityId: ref.id,
      url: `/admin/messages/${ref.id}`,
      groupKey: `support:${ref.id}:customer_messages`,
    }),
  );
}

export function onSupportAdminReply(conversation, preview) {
  const ref = conversationRef(conversation);
  if (!ref.customerId) return; // Guest contact-form threads have no account inbox.
  dispatchNotification("support.admin_reply", () =>
    notifyCustomer(ref.customerId, {
      type: NOTIFICATION_TYPE.SUPPORT_REPLY,
      title: "Support replied to your message",
      message: `${ref.subject}: ${preview}`,
      entityType: NOTIFICATION_ENTITY.SUPPORT_CONVERSATION,
      entityId: ref.id,
      url: `/account/support?c=${ref.id}`,
      groupKey: `support:${ref.id}:replies`,
    }),
  );
}

/**
 * @param {Record<string, any>} conversation
 * @param {string} previousCustomerStatus
 * @param {string} customerStatus
 */
export function onSupportStatusChanged(conversation, previousCustomerStatus, customerStatus) {
  const ref = conversationRef(conversation);
  if (!ref.customerId || previousCustomerStatus === customerStatus) return;
  if (![CUSTOMER_SUPPORT_STATUS.RESOLVED, CUSTOMER_SUPPORT_STATUS.CLOSED].includes(customerStatus)) return;
  const stamp = new Date(conversation.updatedAt ?? Date.now()).getTime();
  dispatchNotification("support.status_changed", () =>
    notifyCustomer(ref.customerId, {
      type: NOTIFICATION_TYPE.SUPPORT_STATUS_CHANGED,
      title: customerStatus === CUSTOMER_SUPPORT_STATUS.RESOLVED ? "Support request resolved" : "Support conversation closed",
      message:
        customerStatus === CUSTOMER_SUPPORT_STATUS.RESOLVED
          ? `"${ref.subject}" was marked resolved. Reply within 30 days if you still need help.`
          : `"${ref.subject}" was closed. Start a new conversation anytime.`,
      entityType: NOTIFICATION_ENTITY.SUPPORT_CONVERSATION,
      entityId: ref.id,
      url: `/account/support?c=${ref.id}`,
      dedupeKey: `support:${ref.id}:status:${customerStatus}:${stamp}`,
    }),
  );
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** @param {{ _id: unknown; jobName: string; errorSummary?: string; failedCount?: number }} run */
export function onJobFailed(run) {
  dispatchNotification("job.failed", () =>
    notifyAdmins(ADMIN_AUDIENCE.OPERATIONS, {
      type: NOTIFICATION_TYPE.JOB_FAILED,
      severity: NOTIFICATION_SEVERITY.CRITICAL,
      title: `Background job failed: ${run.jobName.replaceAll("_", " ")}`,
      message: `${run.failedCount ?? 0} item(s) failed. ${run.errorSummary ?? ""}`.trim(),
      entityType: NOTIFICATION_ENTITY.JOB,
      entityId: String(run._id),
      url: "/admin/jobs",
      dedupeKey: `job:${run._id}:failed`,
    }),
  );
}
