import mongoose from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS, STATUS_CHANGE_SOURCE } from "@/lib/constants/order-status";
import { Order } from "@/lib/db/models/Order";
import { JobRun } from "@/lib/db/models/JobRun";
import { markOrderPaymentFailed } from "@/lib/services/order.service";
import { reconcileOrderPayment } from "@/lib/services/order-payment-refresh.service";
import { onJobFailed } from "@/lib/notifications/events";

const JOB_NAME = "payment_expiry";

export async function runPaymentExpiryJob({ triggeredBy = "scheduler", batchSize = 25 } = {}) {
  const startedAt = new Date();
  const run = await JobRun.create({
    jobName: JOB_NAME,
    status: "running",
    startedAt,
    triggeredBy,
  });

  let processedCount = 0;
  let failedCount = 0;
  const errors = [];

  try {
    const now = new Date();
    const candidates = await Order.find({
      paymentStatus: PAYMENT_STATUS.PENDING,
      orderStatus: ORDER_STATUS.PENDING_PAYMENT,
      inventoryReserved: true,
      paymentExpiresAt: { $lte: now },
      paymentExpiryProcessedAt: null,
    })
      .sort({ paymentExpiresAt: 1 })
      .limit(batchSize);

    for (const candidate of candidates) {
      const locked = await Order.findOneAndUpdate(
        {
          _id: candidate._id,
          paymentStatus: PAYMENT_STATUS.PENDING,
          inventoryReserved: true,
          paymentExpiresAt: { $lte: now },
          paymentExpiryProcessedAt: null,
        },
        { $set: { paymentExpiryProcessedAt: new Date() } },
        { new: true },
      );

      if (!locked) continue;

      try {
        await reconcileOrderPayment(locked);
        const fresh = await Order.findById(locked._id);
        if (!fresh) continue;
        if (fresh.paymentStatus === PAYMENT_STATUS.PAID) {
          processedCount += 1;
          continue;
        }
        await markOrderPaymentFailed(fresh, "Payment reservation expired.", { expired: true });
        processedCount += 1;
      } catch (error) {
        failedCount += 1;
        errors.push(String(error?.message ?? error));
      }
    }

    run.status = failedCount > 0 && processedCount === 0 ? "failed" : "success";
    run.processedCount = processedCount;
    run.failedCount = failedCount;
    run.finishedAt = new Date();
    run.errorSummary = errors.slice(0, 5).join(" | ");
    await run.save();
    if (failedCount > 0) onJobFailed(run);

    return run;
  } catch (error) {
    run.status = "failed";
    run.failedCount = failedCount + 1;
    run.finishedAt = new Date();
    run.errorSummary = String(error?.message ?? error);
    await run.save();
    onJobFailed(run);
    throw error;
  }
}

export async function getJobRuns(jobName = JOB_NAME, limit = 20) {
  return JobRun.find({ jobName }).sort({ startedAt: -1 }).limit(limit).lean();
}

export { JOB_NAME as PAYMENT_EXPIRY_JOB_NAME };
