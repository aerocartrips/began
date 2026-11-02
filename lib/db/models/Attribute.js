import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { ATTRIBUTE_TYPE_VALUES } from "@/lib/constants/catalog";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";

/**
 * A store's allowed value for a product attribute (fabric, weave, occasion,
 * pattern or colour). Products store the canonical `label`, so storefront
 * filters stay consistent ("Banarasi Silk", never "banarasi silk ").
 */
const attributeSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ATTRIBUTE_TYPE_VALUES, required: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 90, match: /^[a-z0-9-]+$/ },
    /** Swatch colour, for type "color". */
    hex: { type: String, trim: true, default: "", match: /^(#[0-9a-fA-F]{6})?$/ },
    sortOrder: { type: Number, default: 0, min: 0, max: 10000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

attributeSchema.index({ tenantId: 1, type: 1, slug: 1 }, { unique: true });
attributeSchema.index({ tenantId: 1, type: 1, isActive: 1, sortOrder: 1 });
// Attribute labels and swatch colours appear in cached storefront filters.
attributeSchema.post(
  ["save", "updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "findOneAndDelete"],
  () => invalidateCatalogCache(),
);
attributeSchema.plugin(tenantScopePlugin);

export const Attribute = mongoose.models.Attribute ?? mongoose.model("Attribute", attributeSchema);
