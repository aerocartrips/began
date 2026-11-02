import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

/** A store's edited copy of a content page (about, FAQ, policies). */
const sectionSchema = new mongoose.Schema(
  {
    heading: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
  },
  { _id: false },
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 300 },
    answer: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { _id: false },
);

const storePageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    summary: { type: String, trim: true, maxlength: 400, default: "" },
    sections: { type: [sectionSchema], default: [] },
    faqs: { type: [faqSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

storePageSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
storePageSchema.plugin(tenantScopePlugin);

export const StorePage = mongoose.models.StorePage ?? mongoose.model("StorePage", storePageSchema);
