import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, max: 100000 },
    selectedAttributes: { type: Map, of: String, default: {} },
  },
  { _id: true, timestamps: false },
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

cartSchema.index({ tenantId: 1, user: 1 }, { unique: true });
cartSchema.plugin(tenantScopePlugin);

export const Cart =
  mongoose.models.Cart ?? mongoose.model("Cart", cartSchema);
