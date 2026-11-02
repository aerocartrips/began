import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

export const SERVICE_REQUEST_TYPE = {
  RETURN: "return",
  CANCELLATION: "cancellation",
};

export const SERVICE_REQUEST_STATUS = {
  REQUESTED: "requested",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  REFUND_PENDING: "refund_pending",
  REFUNDED: "refunded",
  COMPLETED: "completed",
};

const historySchema = new mongoose.Schema(
  {
    previousStatus: { type: String, trim: true, maxlength: 40 },
    newStatus: { type: String, trim: true, maxlength: 40 },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    changedByLabel: { type: String, trim: true, maxlength: 120, default: "" },
    remarks: { type: String, trim: true, maxlength: 2000, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const serviceRequestSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: Object.values(SERVICE_REQUEST_TYPE), required: true },
    status: {
      type: String,
      enum: Object.values(SERVICE_REQUEST_STATUS),
      default: SERVICE_REQUEST_STATUS.REQUESTED,
    },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    customerRemarks: { type: String, trim: true, maxlength: 2000, default: "" },
    internalNotes: { type: String, trim: true, maxlength: 4000, default: "" },
    refundStatus: { type: String, trim: true, maxlength: 40, default: "none" },
    razorpayRefundId: { type: String, trim: true, maxlength: 64, default: "" },
    statusHistory: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

serviceRequestSchema.index({ tenantId: 1, type: 1, status: 1, createdAt: -1 });

serviceRequestSchema.index({ tenantId: 1, order: 1 });
serviceRequestSchema.index({ tenantId: 1, customer: 1, createdAt: -1 });
serviceRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
serviceRequestSchema.plugin(tenantScopePlugin);

export const ServiceRequest =
  mongoose.models.ServiceRequest ?? mongoose.model("ServiceRequest", serviceRequestSchema);
