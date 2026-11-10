import { REVIEW_MODERATION_STATUS, REVIEW_VERIFICATION_STATUS } from "@/lib/constants/review-status";
import { buildClientDeliveryUrl } from "@/lib/cloudinary/transformations";

/**
 * What the storefront and the account pages may see of a review. Kept free of
 * upload and database dependencies so cached page reads (lib/catalog/reviews.js)
 * can share it with the API routes.
 */

/** Public byline: the reviewer's first name only. */
function displayNameFromUser(user) {
  if (!user?.name) return "Verified buyer";
  const first = String(user.name).trim().split(/\s+/)[0];
  return first || "Verified buyer";
}

const toIsoString = (value) => (value ? new Date(value).toISOString() : undefined);

function mapReviewImage(image) {
  const publicId = image.publicId;
  return {
    _id: String(image._id),
    publicId,
    url: image.secureUrl || image.url,
    thumbnailUrl: buildClientDeliveryUrl(publicId, "thumbnail") || image.secureUrl || image.url,
    alt: image.alt || "Customer review photo",
    width: image.width,
    height: image.height,
  };
}

/**
 * @param {Record<string, any>} review Review document or lean object
 * @param {Record<string, any> | null | undefined} userDoc populated author
 * @returns {import("@/features/reviews/types").PublicReview}
 */
export function toPublicReview(review, userDoc) {
  const doc = typeof review.toObject === "function" ? review.toObject() : review;
  return {
    _id: String(doc._id),
    productId: String(doc.product?._id ?? doc.product),
    orderId: String(doc.order?._id ?? doc.order),
    rating: doc.rating,
    title: doc.title ?? "",
    comment: doc.comment,
    images: (doc.images ?? []).map(mapReviewImage),
    verificationStatus: doc.verificationStatus,
    moderationStatus: doc.moderationStatus,
    moderationNote:
      doc.moderationStatus === REVIEW_MODERATION_STATUS.REJECTED ? doc.moderationNote ?? "" : "",
    helpfulCount: doc.helpfulCount ?? 0,
    createdAt: toIsoString(doc.createdAt),
    updatedAt: toIsoString(doc.updatedAt),
    authorName: displayNameFromUser(userDoc),
    verifiedPurchase: doc.verificationStatus === REVIEW_VERIFICATION_STATUS.VERIFIED,
  };
}

/**
 * A review as anyone browsing the store sees it (product page and its API):
 * no order reference.
 * @param {Record<string, any>} review
 * @param {Record<string, any> | null | undefined} userDoc
 * @returns {import("@/features/reviews/types").PublicReview}
 */
export function toStorefrontReview(review, userDoc) {
  const { orderId: _orderId, ...visible } = toPublicReview(review, userDoc);
  return visible;
}

/** The author's own view of their review (account pages): no public byline. */
export function toCustomerReview(review) {
  return { ...toPublicReview(review, review.user), authorName: undefined };
}
