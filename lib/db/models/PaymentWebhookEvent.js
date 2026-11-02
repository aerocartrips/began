import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { WEBHOOK_PROCESSING_STATUS } from "@/lib/constants/payment-status";

const paymentWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    eventType: { type: String, required: true, trim: true, maxlength: 120 },
    paymentId: { type: String, trim: true, maxlength: 120, default: "" },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    processingStatus: {
      type: String,
      enum: Object.values(WEBHOOK_PROCESSING_STATUS),
      default: WEBHOOK_PROCESSING_STATUS.RECEIVED,
    },
    processedAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

paymentWebhookEventSchema.index({ tenantId: 1, eventId: 1 }, { unique: true });
paymentWebhookEventSchema.index({ tenantId: 1, paymentId: 1 });
paymentWebhookEventSchema.index({ tenantId: 1, processingStatus: 1, createdAt: -1 });
paymentWebhookEventSchema.plugin(tenantScopePlugin);

export const PaymentWebhookEvent =
  mongoose.models.PaymentWebhookEvent ??
  mongoose.model("PaymentWebhookEvent", paymentWebhookEventSchema);
