import { Payment } from "@/lib/db/models/Payment";
import { Order } from "@/lib/db/models/Order";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { getPublicRazorpayKeyId, isRazorpayConfigured } from "@/lib/razorpay/config";
import { PAYMENT_RECORD_STATUS } from "@/lib/constants/payment-status";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";
import { ApiError } from "@/lib/utils/api-error";
import { logger } from "@/lib/utils/logger";
import { runAfterResponse } from "@/lib/utils/background";
import { assertDraftPriceable, buildOrderDraft, createPendingPaymentOrder } from "@/lib/services/order.service";
import { abandonUnstartedCheckout } from "@/lib/services/order-lifecycle.service";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";
// Registers schemas used by populate() below.
import "@/lib/db/models/User";

/** A resumed checkout must leave the shopper at least this long to pay. */
const RESUME_MIN_REMAINING_MS = 2 * 60 * 1000;

/**
 * Starts (or resumes) online payment for the shopper's checkout and returns
 * what Razorpay Checkout needs. Paying again for the same cart and addresses
 * reuses the unpaid order and its Razorpay order, so the stock is held once.
 */
export async function createCheckoutPaymentOrder(user, payload) {
  if (!(await isRazorpayConfigured())) {
    throw new ApiError(503, "Online payment is not available right now. Please contact us to complete your order.");
  }

  // Resume before checking stock: the shopper's own unpaid order may be what holds it.
  const draft = await buildOrderDraft(user, payload, { strict: false });
  const resumed = await resumeCheckout(user, draft.signature);
  if (resumed) return resumed;
  assertDraftPriceable(draft);

  const order = await createPendingPaymentOrder(user, payload, { draft });
  let razorpayOrderId;
  try {
    const razorpay = await getRazorpayClient();
    const razorpayOrder = await razorpay.orders.create({
      amount: order.amountPaise,
      currency: order.currency,
      receipt: order.orderNumber,
      notes: {
        internalOrderId: String(order._id),
        orderNumber: order.orderNumber,
      },
    });
    await Payment.create({
      order: order._id,
      user: user._id,
      razorpayOrderId: razorpayOrder.id,
      amount: order.amountPaise,
      currency: order.currency,
      status: PAYMENT_RECORD_STATUS.CREATED,
      receipt: order.orderNumber,
      metadata: { orderNumber: order.orderNumber },
    });
    razorpayOrderId = razorpayOrder.id;
  } catch (error) {
    // Nothing can be paid for this order: release its stock now rather than at expiry.
    logger.error("Payment could not be started", { error, orderId: String(order._id) });
    await abandonUnstartedCheckout(order._id).catch((cancelError) =>
      logger.error("Unstarted checkout could not be cancelled; the expiry job will release it", {
        error: cancelError,
        orderId: String(order._id),
      }),
    );
    throw new ApiError(502, "We could not start the payment. Please try again in a moment.");
  }

  // Frees stock held by abandoned checkouts, even where no scheduler calls the cron route.
  runAfterResponse("Payment expiry sweep", async () => {
    const { runPaymentExpiryJobIfDue } = await import("@/lib/jobs/payment-expiry.job");
    await runPaymentExpiryJobIfDue();
  });
  return checkoutPayload(order, razorpayOrderId);
}

/**
 * The shopper's unpaid order for this exact checkout, if it can still be paid.
 * @param {Record<string, any>} user
 * @param {string} signature
 */
async function resumeCheckout(user, signature) {
  const order = await Order.findOne({
    customer: user._id,
    orderStatus: ORDER_STATUS.PENDING_PAYMENT,
    paymentStatus: PAYMENT_STATUS.PENDING,
    checkoutSignature: signature,
    paymentExpiresAt: { $gt: new Date(Date.now() + RESUME_MIN_REMAINING_MS) },
  })
    .sort({ createdAt: -1 })
    .select("orderNumber amountPaise currency");
  if (!order) return null;
  const payment = await Payment.findOne({
    order: order._id,
    razorpayOrderId: { $type: "string" },
    status: { $in: [PAYMENT_RECORD_STATUS.CREATED, PAYMENT_RECORD_STATUS.FAILED] },
  })
    .sort({ createdAt: -1 })
    .select("razorpayOrderId")
    .lean();
  return payment ? checkoutPayload(order, payment.razorpayOrderId) : null;
}

/** @param {{ _id: unknown, orderNumber: string, amountPaise: number, currency: string }} order */
async function checkoutPayload(order, razorpayOrderId) {
  return {
    key: await getPublicRazorpayKeyId(),
    razorpayOrderId,
    amount: order.amountPaise,
    currency: order.currency,
    internalOrderId: String(order._id),
    orderNumber: order.orderNumber,
  };
}

export async function getPaymentForUser(paymentId, user, isAdmin) {
  const payment = await Payment.findById(paymentId).populate("order").populate("user", "name email");
  if (!payment) throw new ApiError(404, "Payment not found.");
  if (!isAdmin && String(payment.user._id ?? payment.user) !== String(user._id)) {
    throw new ApiError(403, "You do not have access to this payment.");
  }
  return payment;
}

export async function listPayments(searchParams) {
  const { page, limit, skip } = parsePagination(searchParams);
  const filter = {};
  const status = searchParams.get("status");
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("order", "orderNumber totalAmount paymentStatus orderStatus")
      .populate("user", "name email companyName"),
    Payment.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta(total, page, limit) };
}
