import mongoose from "mongoose";
import { WEBHOOK_PROCESSING_STATUS } from "@/lib/constants/payment-status";

const paymentWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, trim: true, maxlength: 120, index: true },
    paymentId: { type: String, trim: true, maxlength: 120, default: "", index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    processingStatus: {
      type: String,
      enum: Object.values(WEBHOOK_PROCESSING_STATUS),
      default: WEBHOOK_PROCESSING_STATUS.RECEIVED,
      index: true,
    },
    processedAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

export const PaymentWebhookEvent =
  mongoose.models.PaymentWebhookEvent ??
  mongoose.model("PaymentWebhookEvent", paymentWebhookEventSchema);
