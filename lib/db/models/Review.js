import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import {
  REVIEW_MODERATION_STATUS,
  REVIEW_MODERATION_VALUES,
  REVIEW_VERIFICATION_STATUS,
} from "@/lib/constants/review-status";

const reviewImageSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, trim: true, maxlength: 260 },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    secureUrl: { type: String, trim: true, maxlength: 2048, default: "" },
    alt: { type: String, trim: true, maxlength: 160, default: "" },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    format: { type: String, trim: true, maxlength: 12, default: "" },
    bytes: { type: Number, min: 0 },
  },
  { _id: true },
);

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120, default: "" },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },
    images: { type: [reviewImageSchema], default: [] },
    verificationStatus: {
      type: String,
      enum: Object.values(REVIEW_VERIFICATION_STATUS),
      default: REVIEW_VERIFICATION_STATUS.VERIFIED,
    },
    moderationStatus: {
      type: String,
      enum: REVIEW_MODERATION_VALUES,
      default: REVIEW_MODERATION_STATUS.PENDING,
    },
    moderationNote: { type: String, trim: true, maxlength: 500, default: "" },
    moderatedAt: { type: Date, default: null },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    helpfulCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

reviewSchema.index({ tenantId: 1, user: 1, product: 1 }, { unique: true });
reviewSchema.index({ tenantId: 1, product: 1, moderationStatus: 1, createdAt: -1 });
reviewSchema.index({ tenantId: 1, moderationStatus: 1, createdAt: -1 });
reviewSchema.index({ tenantId: 1, user: 1, createdAt: -1 });

reviewSchema.index({ tenantId: 1, order: 1 });
reviewSchema.plugin(tenantScopePlugin);

export const Review =
  mongoose.models.Review ?? mongoose.model("Review", reviewSchema);
