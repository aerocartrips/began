import mongoose from "mongoose";
import { Review } from "@/lib/db/models/Review";
import { ReviewVote } from "@/lib/db/models/ReviewVote";
import { ApiError } from "@/lib/utils/api-error";
import { REVIEW_MODERATION_STATUS } from "@/lib/constants/review-status";

export async function markReviewHelpful(reviewId, user) {
  if (!mongoose.isValidObjectId(reviewId)) throw new ApiError(404, "Review not found.");

  const review = await Review.findById(reviewId);
  if (!review || review.moderationStatus !== REVIEW_MODERATION_STATUS.APPROVED) {
    throw new ApiError(404, "Review not found.");
  }
  if (String(review.customer) === String(user._id)) {
    throw new ApiError(403, "You cannot vote on your own review.");
  }

  try {
    await ReviewVote.create({ review: review._id, user: user._id });
  } catch (error) {
    if (error?.code === 11000) {
      return { reviewId, helpfulCount: review.helpfulCount, voted: true };
    }
    throw error;
  }

  const updated = await Review.findByIdAndUpdate(
    review._id,
    { $inc: { helpfulCount: 1 } },
    { new: true },
  );
  return { reviewId: String(review._id), helpfulCount: updated.helpfulCount, voted: true };
}

export async function removeReviewHelpfulVote(reviewId, user) {
  if (!mongoose.isValidObjectId(reviewId)) throw new ApiError(404, "Review not found.");

  const removed = await ReviewVote.findOneAndDelete({ review: reviewId, user: user._id });
  if (!removed) {
    const review = await Review.findById(reviewId);
    return { reviewId, helpfulCount: review?.helpfulCount ?? 0, voted: false };
  }

  const updated = await Review.findByIdAndUpdate(
    reviewId,
    { $inc: { helpfulCount: -1 } },
    { new: true },
  );
  if (updated && updated.helpfulCount < 0) {
    updated.helpfulCount = 0;
    await updated.save();
  }

  return { reviewId, helpfulCount: updated?.helpfulCount ?? 0, voted: false };
}

export async function getReviewHelpfulState(reviewId, user) {
  if (!user?._id || !mongoose.isValidObjectId(reviewId)) {
    return { voted: false };
  }
  const vote = await ReviewVote.findOne({ review: reviewId, user: user._id }).select("_id");
  return { voted: Boolean(vote) };
}
