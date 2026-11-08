import { PaymentWebhookEvent } from "@/lib/db/models/PaymentWebhookEvent";
import { Payment } from "@/lib/db/models/Payment";
import { WEBHOOK_PROCESSING_STATUS } from "@/lib/constants/payment-status";
import {
  reconcileCapturedPayment,
  recordFailedPaymentAttempt,
} from "@/lib/services/payment-verification.service";
import { processRefundWebhook } from "@/lib/services/refund.service";
import { onWebhookProcessingFailed } from "@/lib/notifications/events";

function getEventId(headers, payload) {
  return headers.get("x-razorpay-event-id") || payload?.id || null;
}

function extractPaymentEntity(payload) {
  return payload?.payload?.payment?.entity ?? null;
}

function extractRefundEntity(payload) {
  return payload?.payload?.refund?.entity ?? null;
}

export async function acceptWebhookEvent(rawBody, headers) {
  const payload = JSON.parse(rawBody);
  const eventId = getEventId(headers, payload);
  if (!eventId) {
    return { accepted: false, reason: "missing_event_id" };
  }

  const existing = await PaymentWebhookEvent.findOne({ eventId });
  if (existing?.processingStatus === WEBHOOK_PROCESSING_STATUS.PROCESSED) {
    return { accepted: true, duplicate: true, event: existing };
  }

  let event = existing;
  if (!event) {
    const paymentEntity = extractPaymentEntity(payload);
    event = await PaymentWebhookEvent.create({
      eventId,
      eventType: payload.event,
      paymentId: paymentEntity?.id || "",
      payload,
      processingStatus: WEBHOOK_PROCESSING_STATUS.RECEIVED,
    });
  }

  try {
    await processWebhookEvent(payload);
    event.processingStatus = WEBHOOK_PROCESSING_STATUS.PROCESSED;
    event.processedAt = new Date();
    event.failureReason = "";
    await event.save();
    return { accepted: true, duplicate: Boolean(existing), event };
  } catch (error) {
    event.processingStatus = WEBHOOK_PROCESSING_STATUS.FAILED;
    event.failureReason = error instanceof Error ? error.message : "Webhook processing failed.";
    event.processedAt = new Date();
    await event.save();
    onWebhookProcessingFailed({ eventId, eventType: String(payload.event ?? "unknown"), reason: event.failureReason });
    throw error;
  }
}

async function processWebhookEvent(payload) {
  const eventType = payload.event;
  const paymentEntity = extractPaymentEntity(payload);

  if (eventType === "payment.captured" || eventType === "order.paid") {
    if (!paymentEntity?.id || !paymentEntity.order_id) return;
    const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });
    if (!payment) return;
    await reconcileCapturedPayment({
      razorpayOrderId: paymentEntity.order_id,
      razorpayPaymentId: paymentEntity.id,
      skipSignature: true,
    });
    return;
  }

  if (eventType === "payment.failed") {
    if (!paymentEntity?.order_id) return;
    await recordFailedPaymentAttempt({
      razorpayOrderId: paymentEntity.order_id,
      reason: paymentEntity.error_description || "Payment failed.",
    });
    return;
  }

  if (eventType === "refund.processed" || eventType === "refund.created" || eventType === "refund.failed") {
    const refundEntity = extractRefundEntity(payload);
    if (refundEntity) {
      await processRefundWebhook(refundEntity, eventType);
    }
  }
}
