import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { invalidateBannerCache } from "@/lib/content/banner-cache";

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    publicId: { type: String, trim: true, maxlength: 260, default: "" },
    width: { type: Number, min: 1, default: 1920 },
    height: { type: Number, min: 1, default: 800 },
  },
  { _id: false },
);

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 40, default: "" },
    href: { type: String, trim: true, maxlength: 2048, default: "" },
  },
  { _id: false },
);

/** A home page hero slide, managed in Admin → Banners. */
const bannerSchema = new mongoose.Schema(
  {
    /** Internal name shown in the admin list. */
    name: { type: String, required: true, trim: true, maxlength: 120 },
    eyebrow: { type: String, trim: true, maxlength: 60, default: "" },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 280, default: "" },
    primaryCta: { type: linkSchema, default: () => ({}) },
    secondaryCta: { type: linkSchema, default: () => ({}) },
    image: { type: imageSchema, required: true },
    /** Optional portrait crop for phones (art direction). */
    mobileImage: { type: imageSchema, default: null },
    imageAlt: { type: String, trim: true, maxlength: 160, default: "" },
    textPosition: { type: String, enum: ["left", "center", "right"], default: "left" },
    textTone: { type: String, enum: ["light", "dark"], default: "light" },
    /** Darkening scrim over the image, 0–80 %, for text contrast. */
    overlayOpacity: { type: Number, min: 0, max: 80, default: 35 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, min: 0, max: 10000, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

bannerSchema.index({ tenantId: 1, isActive: 1, sortOrder: 1 });
bannerSchema.index({ tenantId: 1, sortOrder: 1 });

// Live banners are cached per store; any write refreshes the home page.
bannerSchema.post(
  ["save", "updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "findOneAndDelete", "bulkWrite"],
  () => invalidateBannerCache(),
);
bannerSchema.plugin(tenantScopePlugin);

export const Banner = mongoose.models.Banner ?? mongoose.model("Banner", bannerSchema);
