import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    image: {
      url: { type: String, trim: true, default: "" },
      alt: { type: String, trim: true, default: "" },
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, min: 0, max: 10000 },
  },
  { timestamps: true },
);

categorySchema.index({ parentCategory: 1, sortOrder: 1 });

export const Category =
  mongoose.models.Category ?? mongoose.model("Category", categorySchema);
