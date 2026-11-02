import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true },
);

wishlistSchema.index({ tenantId: 1, user: 1 }, { unique: true });
wishlistSchema.plugin(tenantScopePlugin);

export const Wishlist =
  mongoose.models.Wishlist ?? mongoose.model("Wishlist", wishlistSchema);
