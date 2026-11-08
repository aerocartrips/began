import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

/** Why a product's stock changed. Every stock write records one of these. */
export const STOCK_MOVEMENT_REASON = {
  /** Stock held for a new order (negative). */
  ORDER_RESERVED: "order_reserved",
  /** Held stock returned: the order expired, failed or was cancelled before dispatch (positive). */
  ORDER_RELEASED: "order_released",
  /** Payment arrived after the order was cancelled and the stock was held again (negative). */
  ORDER_REINSTATED: "order_reinstated",
  /** A store admin set a new stock level (either sign). */
  ADMIN_SET: "admin_set",
};

/**
 * Append-only stock ledger. Product.stockQuantity stays the source of truth for
 * availability; this records who or what moved it, so any stock figure can be
 * explained and audited. Written in the same transaction as the stock change.
 */
const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    delta: { type: Number, required: true },
    reason: { type: String, enum: Object.values(STOCK_MOVEMENT_REASON), required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

stockMovementSchema.index({ tenantId: 1, product: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, order: 1 }, { partialFilterExpression: { order: { $type: "objectId" } } });
stockMovementSchema.plugin(tenantScopePlugin);

export const StockMovement =
  mongoose.models.StockMovement ?? mongoose.model("StockMovement", stockMovementSchema);
