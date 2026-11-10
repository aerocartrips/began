import mongoose from "mongoose";
import { cacheLife, cacheTag } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { Review } from "@/lib/db/models/Review";
import { PUBLIC_REVIEW_PAGE_SIZE, REVIEW_MODERATION_STATUS } from "@/lib/constants/review-status";
import { catalogCacheTag } from "@/lib/catalog/catalog-cache";
import { toStorefrontReview } from "@/lib/services/review-dto";
import { runWithTenant } from "@/lib/tenant/context";
// Registers the User schema for review author names.
import "@/lib/db/models/User";

/**
 * The first page of a product's approved reviews, newest first, rendered with
 * the product page so it needs no request of its own (sorting, filters and
 * later pages use GET /api/v1/products/:id/reviews). Cached with the catalogue:
 * approving, rejecting, editing or deleting a review recomputes the product's
 * rating summary, and that product write invalidates this entry too.
 * @param {string} tenantId
 * @param {string} productId
 * @returns {Promise<{ reviews: import("@/features/reviews/types").PublicReview[], total: number }>}
 */
export async function getProductReviewPreview(tenantId, productId) {
  "use cache";
  cacheLife("minutes");
  cacheTag(catalogCacheTag(tenantId));

  if (!mongoose.isValidObjectId(productId)) return { reviews: [], total: 0 };
  await connectDB();
  return runWithTenant(tenantId, async () => {
    const filter = { product: productId, moderationStatus: REVIEW_MODERATION_STATUS.APPROVED };
    const [docs, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).limit(PUBLIC_REVIEW_PAGE_SIZE).populate("user", "name").lean(),
      Review.countDocuments(filter),
    ]);
    return { reviews: docs.map((doc) => toStorefrontReview(doc, doc.user)), total };
  });
}
