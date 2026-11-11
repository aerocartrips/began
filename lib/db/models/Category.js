import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    /** Slugs from earlier names; their URLs redirect permanently to the current one. */
    previousSlugs: { type: [{ type: String, lowercase: true, trim: true }], default: [] },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    image: {
      url: { type: String, trim: true, default: "" },
      alt: { type: String, trim: true, default: "" },
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0, max: 10000 },
  },
  { timestamps: true },
);

categorySchema.index({ tenantId: 1, parentCategory: 1, sortOrder: 1 });

categorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });
categorySchema.index({ tenantId: 1, previousSlugs: 1 });
categorySchema.index({ tenantId: 1, isActive: 1, sortOrder: 1 });
// Category names, images and visibility appear on cached catalog pages.
categorySchema.post(
  ["save", "updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "findOneAndDelete"],
  () => invalidateCatalogCache(),
);
categorySchema.plugin(tenantScopePlugin);

export const Category =
  mongoose.models.Category ?? mongoose.model("Category", categorySchema);
