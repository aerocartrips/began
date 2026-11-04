import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { invalidateGuidesCache } from "@/lib/content/guides-cache";

export const GUIDE_STATUS = { DRAFT: "draft", PUBLISHED: "published" };

const sectionSchema = new mongoose.Schema(
  {
    heading: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
  },
  { _id: false },
);

/** A buying guide or editorial article (fabric guides, care tips, wholesale advice). Plain text, never HTML. */
const guideSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 90 },
    excerpt: { type: String, trim: true, maxlength: 300, default: "" },
    coverImage: {
      type: new mongoose.Schema(
        {
          url: { type: String, required: true, trim: true, maxlength: 2048 },
          publicId: { type: String, trim: true, maxlength: 260, default: "" },
          width: { type: Number, min: 1, default: 1600 },
          height: { type: Number, min: 1, default: 900 },
        },
        { _id: false },
      ),
      default: null,
    },
    coverAlt: { type: String, trim: true, maxlength: 160, default: "" },
    sections: { type: [sectionSchema], default: [] },
    status: { type: String, enum: Object.values(GUIDE_STATUS), default: GUIDE_STATUS.DRAFT },
    /** Set the first time the guide is published; drives ordering. */
    publishedAt: { type: Date, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

guideSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
guideSchema.index({ tenantId: 1, status: 1, publishedAt: -1, _id: -1 });

guideSchema.post(["save", "updateOne", "findOneAndUpdate", "deleteOne", "findOneAndDelete"], () => invalidateGuidesCache());
guideSchema.plugin(tenantScopePlugin);

export const Guide = mongoose.models.Guide ?? mongoose.model("Guide", guideSchema);
