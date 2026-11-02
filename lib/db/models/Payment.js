import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { PAYMENT_RECORD_STATUS, REFUND_STATUS } from "@/lib/constants/payment-status";

const refundEntrySchema = new mongoose.Schema(
  {
    razorpayRefundId: { type: String, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: Object.values(REFUND_STATUS), default: REFUND_STATUS.PENDING },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    adminUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    razorpayOrderId: { type: String, trim: true, maxlength: 120 },
    razorpayPaymentId: { type: String, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, default: "INR", uppercase: true, maxlength: 3 },
    status: {
      type: String,
      enum: Object.values(PAYMENT_RECORD_STATUS),
      default: PAYMENT_RECORD_STATUS.CREATED,
    },
    method: { type: String, trim: true, maxlength: 40, default: "" },
    capturedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, maxlength: 500, default: "" },
    receipt: { type: String, trim: true, maxlength: 120, default: "" },
    refundStatus: { type: String, enum: Object.values(REFUND_STATUS), default: REFUND_STATUS.NONE },
    refundedAmount: { type: Number, default: 0, min: 0 },
    refunds: { type: [refundEntrySchema], default: [] },
    confirmationNotifiedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentSchema.index({ tenantId: 1, user: 1, createdAt: -1 });

paymentSchema.index({ tenantId: 1, order: 1 });
paymentSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, razorpayOrderId: 1 }, { unique: true, partialFilterExpression: { razorpayOrderId: { $type: "string" } } });
paymentSchema.index({ tenantId: 1, razorpayPaymentId: 1 }, { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string" } } });
paymentSchema.plugin(tenantScopePlugin);

export const Payment =
  mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema);
