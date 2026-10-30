import mongoose from "mongoose";
import { REVIEW_MODERATION_STATUS } from "@/lib/constants/review-status";
import { Review } from "@/lib/db/models/Review";
import { Product } from "@/lib/db/models/Product";

function emptyDistribution() {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

/**
 * Recompute and persist product rating summary from approved reviews.
 * @param {string | import("mongoose").Types.ObjectId} productId
 * @param {import("mongoose").ClientSession | null} [session]
 */
export async function recomputeProductRatingSummary(productId, session = null) {
  const productObjectId = new mongoose.Types.ObjectId(String(productId));
  const pipeline = [
    {
      $match: {
        product: productObjectId,
        moderationStatus: REVIEW_MODERATION_STATUS.APPROVED,
      },
    },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
  ];

  const rows = await Review.aggregate(pipeline).session(session ?? undefined);
  const distribution = emptyDistribution();
  let totalReviews = 0;
  let weighted = 0;

  for (const row of rows) {
    const rating = Number(row._id);
    const count = Number(row.count);
    if (rating >= 1 && rating <= 5) {
      distribution[rating] = count;
      totalReviews += count;
      weighted += rating * count;
    }
  }

  const averageRating =
    totalReviews === 0 ? 0 : Math.round((weighted / totalReviews) * 10) / 10;

  await Product.updateOne(
    { _id: productObjectId },
    {
      $set: {
        ratingSummary: {
          averageRating,
          totalReviews,
          distribution,
        },
      },
    },
  ).session(session ?? undefined);

  return { averageRating, totalReviews, distribution };
}

/**
 * @param {string} productId
 */
export async function getProductRatingSummary(productId) {
  if (!mongoose.isValidObjectId(productId)) {
    return { averageRating: 0, totalReviews: 0, distribution: emptyDistribution() };
  }
  const product = await Product.findById(productId).select("ratingSummary").lean();
  if (!product?.ratingSummary) {
    return { averageRating: 0, totalReviews: 0, distribution: emptyDistribution() };
  }
  return {
    averageRating: product.ratingSummary.averageRating ?? 0,
    totalReviews: product.ratingSummary.totalReviews ?? 0,
    distribution: { ...emptyDistribution(), ...(product.ratingSummary.distribution ?? {}) },
  };
}
