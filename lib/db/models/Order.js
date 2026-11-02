import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { ORDER_STATUS, PAYMENT_STATUS, RETURN_REQUEST_STATUS } from "@/lib/constants/order-status";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    /** Colour variant ordered, if the product has variants. */
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    productName: { type: String, required: true, trim: true, maxlength: 180 },
    sku: { type: String, required: true, trim: true, maxlength: 64 },
    colorName: { type: String, trim: true, maxlength: 60, default: "" },
    hsnCode: { type: String, trim: true, maxlength: 8, default: "" },
    gstRatePercent: { type: Number, min: 0, max: 28, default: null },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    selectedAttributes: { type: Map, of: String, default: {} },
    imageUrl: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: false },
);

const addressSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true, default: "" },
    landmark: { type: String, trim: true, default: "" },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: "India" },
    // No defaults: orders placed before these were snapshotted keep them undefined,
    // which lets invoices fall back to the customer profile for legacy orders only.
    companyName: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
  },
  { _id: false },
);

const statusHistorySchema = new mongoose.Schema(
  {
    previousOrderStatus: { type: String, trim: true, maxlength: 40 },
    newOrderStatus: { type: String, trim: true, maxlength: 40 },
    previousPaymentStatus: { type: String, trim: true, maxlength: 40 },
    newPaymentStatus: { type: String, trim: true, maxlength: 40 },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    changedByLabel: { type: String, trim: true, maxlength: 120, default: "" },
    source: { type: String, trim: true, maxlength: 40, default: "system" },
    remarks: { type: String, trim: true, maxlength: 2000, default: "" },
    customerVisibleRemark: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const shipmentBookingAttemptSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    status: { type: String, trim: true, maxlength: 40 },
    requestId: { type: String, trim: true, maxlength: 64, default: "" },
    responseSummary: { type: String, trim: true, maxlength: 500, default: "" },
    error: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: true },
);

const shipmentSchema = new mongoose.Schema(
  {
    carrier: { type: String, trim: true, maxlength: 80, default: "Delhivery" },
    awb: { type: String, trim: true, maxlength: 64 },
    lrNumber: { type: String, trim: true, maxlength: 64, default: "" },
    status: { type: String, trim: true, maxlength: 80, default: "" },
    bookingStatus: {
      type: String,
      enum: [
        "not_created",
        "booking",
        "reconciliation_required",
        "booked",
        "manifest_pending",
        "manifest_generated",
        "booking_failed",
        "cancelled",
      ],
      default: "not_created",
    },
    manifestStatus: { type: String, trim: true, maxlength: 80, default: "" },
    packageWeightKg: { type: Number, min: 0, default: 0 },
    boxCount: { type: Number, min: 1, default: 1 },
    freightMode: { type: String, trim: true, maxlength: 40, default: "prepaid" },
    bookingLockedAt: { type: Date, default: null },
    createdAt: { type: Date, default: null },
    estimatedDelivery: { type: Date, default: null },
    trackingFetchedAt: { type: Date, default: null },
    trackingCache: { type: mongoose.Schema.Types.Mixed, default: null },
    bookingAttempts: { type: [shipmentBookingAttemptSchema], default: [] },
    lastBookingResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, uppercase: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], validate: [(v) => v.length > 0, "Order must contain items."] },
    shippingAddress: { type: addressSnapshotSchema, required: true },
    billingAddress: { type: addressSnapshotSchema, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    shippingCharges: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, trim: true, maxlength: 40, default: "bank_transfer" },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    orderStatus: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    internalNotes: { type: String, trim: true, maxlength: 4000, default: "" },
    customerVisibleRemark: { type: String, trim: true, maxlength: 1000, default: "" },
    amountPaise: { type: Number, min: 1 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "INR" },
    inventoryReserved: { type: Boolean, default: false },
    paymentExpiresAt: { type: Date, default: null },
    paymentExpiryProcessedAt: { type: Date, default: null },
    paymentConfirmedNotifiedAt: { type: Date, default: null },
    statusHistory: { type: [statusHistorySchema], default: [] },
    shipment: { type: shipmentSchema, default: () => ({}) },
    cancellation: {
      reason: { type: String, trim: true, maxlength: 500, default: "" },
      cancelledAt: { type: Date, default: null },
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    returnRequest: {
      status: {
        type: String,
        enum: Object.values(RETURN_REQUEST_STATUS),
        default: RETURN_REQUEST_STATUS.NONE,
      },
      reason: { type: String, trim: true, maxlength: 500, default: "" },
      remarks: { type: String, trim: true, maxlength: 2000, default: "" },
      requestedAt: { type: Date, default: null },
    },
    invoice: {
      number: { type: String, trim: true, uppercase: true, maxlength: 40 },
      issuedAt: { type: Date, default: null },
    },
    cancellationRefund: {
      status: {
        type: String,
        enum: ["none", "pending", "processing", "completed", "failed", "manual_review"],
        default: "none",
      },
      razorpayRefundId: { type: String, trim: true, maxlength: 64, default: "" },
      updatedAt: { type: Date, default: null },
      message: { type: String, trim: true, maxlength: 500, default: "" },
    },
  },
  { timestamps: true },
);

orderSchema.index({ tenantId: 1, customer: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, customer: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, customer: 1, paymentStatus: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, paymentStatus: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, paymentStatus: 1, paymentExpiresAt: 1, inventoryReserved: 1 });
orderSchema.index({ tenantId: 1, "shipment.bookingStatus": 1, updatedAt: -1 });

orderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ tenantId: 1, "shipment.awb": 1 });
orderSchema.index({ tenantId: 1, "invoice.number": 1 }, { partialFilterExpression: { "invoice.number": { $type: "string" } } });
orderSchema.plugin(tenantScopePlugin);

export const Order =
  mongoose.models.Order ?? mongoose.model("Order", orderSchema);
