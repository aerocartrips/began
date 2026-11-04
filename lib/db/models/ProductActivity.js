import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

/**
 * Daily interest counters per product (views, wishlist adds, add-to-carts),
 * already de-duplicated per shopper (lib/services/product-activity.service.js).
 * No shopper data is stored: only totals per product per day. Orders are read
 * from the Order collection directly, so they are not counted here.
 */
const productActivitySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    /** UTC midnight of the day the events happened. */
    day: { type: Date, required: true },
    views: { type: Number, default: 0, min: 0 },
    wishlists: { type: Number, default: 0, min: 0 },
    carts: { type: Number, default: 0, min: 0 },
  },
  { versionKey: false },
);

productActivitySchema.index({ tenantId: 1, product: 1, day: 1 }, { unique: true });
productActivitySchema.index({ tenantId: 1, day: -1 });
// Popularity looks back at most a few months; older rows are removed by MongoDB.
productActivitySchema.index({ day: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

productActivitySchema.plugin(tenantScopePlugin);

export const ProductActivity =
  mongoose.models.ProductActivity ?? mongoose.model("ProductActivity", productActivitySchema);
