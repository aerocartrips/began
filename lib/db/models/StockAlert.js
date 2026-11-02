import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

/** A customer's explicit opt-in to hear when an unavailable product can be ordered again. */
const stockAlertSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    /** Set once the alert fires; a fired alert is one-shot until the customer subscribes again. */
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

stockAlertSchema.index({ tenantId: 1, product: 1, customer: 1 }, { unique: true });
stockAlertSchema.index({ tenantId: 1, product: 1, notifiedAt: 1 });
stockAlertSchema.index({ tenantId: 1, customer: 1 });

stockAlertSchema.plugin(tenantScopePlugin);

export const StockAlert = mongoose.models.StockAlert ?? mongoose.model("StockAlert", stockAlertSchema);
