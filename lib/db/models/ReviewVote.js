import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

const reviewVoteSchema = new mongoose.Schema(
  {
    review: { type: mongoose.Schema.Types.ObjectId, ref: "Review", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

reviewVoteSchema.index({ tenantId: 1, review: 1, user: 1 }, { unique: true });

reviewVoteSchema.index({ tenantId: 1, user: 1 });
reviewVoteSchema.plugin(tenantScopePlugin);

export const ReviewVote =
  mongoose.models.ReviewVote ?? mongoose.model("ReviewVote", reviewVoteSchema);
