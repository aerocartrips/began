import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";
import { Order } from "@/lib/db/models/Order";
import { JobRun } from "@/lib/db/models/JobRun";
import { runLockedJob } from "@/lib/jobs/run-locked-job";
import { expireUnpaidOrder } from "@/lib/services/order-lifecycle.service";
import { reconcileOrderPayment } from "@/lib/services/order-payment-refresh.service";

const JOB_NAME = "payment_expiry";
/** How long one run's claim on an order lasts; an order whose run failed is retried after this. */
const CLAIM_LEASE_MS = 10 * 60 * 1000;
/** Opportunistic runs (see runPaymentExpiryJobIfDue) start at most this often per store. */
const OPPORTUNISTIC_INTERVAL_MS = 5 * 60 * 1000;

const AWAITING_PAYMENT = { paymentStatus: PAYMENT_STATUS.PENDING, orderStatus: ORDER_STATUS.PENDING_PAYMENT };

/**
 * Settles unpaid orders whose reservation window has ended. Each order is first
 * checked with Razorpay by Razorpay order, so a payment completed after the
 * shopper left (or one the webhook has not delivered yet) confirms the order
 * instead of losing it. Orders with a payment still being authorised are left
 * for a later run; the rest are cancelled and their stock released.
 */
export async function runPaymentExpiryJob({ triggeredBy = "scheduler", batchSize = 25 } = {}) {
  return runLockedJob(JOB_NAME, { triggeredBy }, async () => {
    const now = new Date();
    const unclaimed = {
      $or: [
        { paymentExpiryProcessedAt: null },
        { paymentExpiryProcessedAt: { $lte: new Date(now.getTime() - CLAIM_LEASE_MS) } },
      ],
    };
    const candidates = await Order.find({ ...AWAITING_PAYMENT, paymentExpiresAt: { $lte: now }, ...unclaimed })
      .sort({ paymentExpiresAt: 1 })
      .limit(batchSize)
      .select("_id")
      .lean();

    let processedCount = 0;
    let failedCount = 0;
    const errors = [];
    for (const { _id } of candidates) {
      // Claim the order so overlapping runs never settle it twice.
      const claimed = await Order.findOneAndUpdate(
        { _id, ...AWAITING_PAYMENT, ...unclaimed },
        { $set: { paymentExpiryProcessedAt: new Date() } },
        { returnDocument: "after" },
      );
      if (!claimed) continue;

      try {
        const { state } = await reconcileOrderPayment(claimed);
        // An authorised payment may still be captured: keep the claim and look again after the lease.
        if (state === "authorized") continue;
        if (state !== "paid") await expireUnpaidOrder(_id);
        processedCount += 1;
      } catch (error) {
        // The claim stays, so this order is retried once its lease runs out.
        failedCount += 1;
        errors.push(`${claimed.orderNumber}: ${String(error?.message ?? error)}`);
      }
    }
    return { processedCount, failedCount, errors };
  });
}

/**
 * Runs the expiry job when unpaid orders are overdue and no run started in the
 * last few minutes. Called after checkout requests, so expired reservations are
 * freed at the moment shoppers need the stock, even where no scheduler calls
 * /api/cron/payment-expiry.
 */
export async function runPaymentExpiryJobIfDue() {
  const [lastRun, overdue] = await Promise.all([
    JobRun.findOne({ jobName: JOB_NAME }).sort({ startedAt: -1 }).select("startedAt").lean(),
    Order.exists({ ...AWAITING_PAYMENT, paymentExpiresAt: { $lte: new Date() } }),
  ]);
  if (!overdue) return null;
  if (lastRun && Date.now() - new Date(lastRun.startedAt).getTime() < OPPORTUNISTIC_INTERVAL_MS) return null;
  return runPaymentExpiryJob({ triggeredBy: "checkout" });
}

export async function getJobRuns(jobName = JOB_NAME, limit = 20) {
  return JobRun.find({ jobName }).sort({ startedAt: -1 }).limit(limit).lean();
}

export { JOB_NAME as PAYMENT_EXPIRY_JOB_NAME };
