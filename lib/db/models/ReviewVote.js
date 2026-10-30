import mongoose from "mongoose";

const reviewVoteSchema = new mongoose.Schema(
  {
    review: { type: mongoose.Schema.Types.ObjectId, ref: "Review", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

reviewVoteSchema.index({ review: 1, user: 1 }, { unique: true });

export const ReviewVote =
  mongoose.models.ReviewVote ?? mongoose.model("ReviewVote", reviewVoteSchema);
