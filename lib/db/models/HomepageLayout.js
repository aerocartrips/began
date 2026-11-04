import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { invalidateHomepageCache } from "@/lib/content/homepage-cache";
import {
  COLLECTION_SORTS,
  COLLECTION_SOURCE_KINDS,
  HOME_SECTION_TYPE_VALUES,
  PRODUCT_TAB_KEYS,
  TRUST_ICONS,
} from "@/lib/constants/homepage";

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 40, default: "" },
    href: { type: String, trim: true, maxlength: 2048, default: "" },
  },
  { _id: false },
);

const trustItemSchema = new mongoose.Schema(
  {
    icon: { type: String, enum: TRUST_ICONS, default: "badge" },
    title: { type: String, trim: true, maxlength: 60, required: true },
    text: { type: String, trim: true, maxlength: 140, default: "" },
  },
  { _id: false },
);

const sectionSchema = new mongoose.Schema(
  {
    /** Stable key for React and admin edits (not a database id). */
    key: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: HOME_SECTION_TYPE_VALUES, required: true },
    enabled: { type: Boolean, default: true },
    title: { type: String, trim: true, maxlength: 80, default: "" },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    limit: { type: Number, min: 1, max: 24, default: 10 },
    viewAllHref: { type: String, trim: true, maxlength: 2048, default: "" },
    showOnMobile: { type: Boolean, default: true },
    showOnDesktop: { type: Boolean, default: true },
    /** Collection sections: where the products come from. */
    source: {
      kind: { type: String, enum: COLLECTION_SOURCE_KINDS, default: "category" },
      value: { type: String, trim: true, maxlength: 120, default: "" },
      productIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      sort: { type: String, enum: COLLECTION_SORTS, default: "popular" },
    },
    /** Product tabs section: which tabs to offer, in order. */
    tabs: { type: [{ type: String, enum: PRODUCT_TAB_KEYS }], default: undefined },
    /** Trust strip items; empty uses the defaults for the store's sales mode. */
    items: { type: [trustItemSchema], default: undefined },
    /** Call-to-action buttons. */
    primaryCta: { type: linkSchema, default: undefined },
    secondaryCta: { type: linkSchema, default: undefined },
  },
  { _id: false },
);

/** One per store: the ordered home page sections, edited in Admin → Home page. */
const homepageLayoutSchema = new mongoose.Schema(
  {
    sections: { type: [sectionSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

homepageLayoutSchema.index({ tenantId: 1 }, { unique: true });

homepageLayoutSchema.post(["save", "updateOne", "findOneAndUpdate", "deleteOne", "findOneAndDelete"], () =>
  invalidateHomepageCache(),
);
homepageLayoutSchema.plugin(tenantScopePlugin);

export const HomepageLayout =
  mongoose.models.HomepageLayout ?? mongoose.model("HomepageLayout", homepageLayoutSchema);
