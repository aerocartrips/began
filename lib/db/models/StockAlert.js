import mongoose from "mongoose";

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

stockAlertSchema.index({ product: 1, customer: 1 }, { unique: true });
stockAlertSchema.index({ product: 1, notifiedAt: 1 });
stockAlertSchema.index({ customer: 1 });

export const StockAlert = mongoose.models.StockAlert ?? mongoose.model("StockAlert", stockAlertSchema);
