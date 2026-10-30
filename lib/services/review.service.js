import mongoose from "mongoose";
import {
  MAX_REVIEW_IMAGES,
  PUBLIC_REVIEW_SORT,
  REVIEW_MODERATION_STATUS,
  REVIEW_VERIFICATION_STATUS,
} from "@/lib/constants/review-status";
import { CLOUDINARY_FOLDERS } from "@/lib/constants/cloudinary-folders";
import { Review } from "@/lib/db/models/Review";
import { Product } from "@/lib/db/models/Product";
import { deleteCloudinaryImages } from "@/lib/cloudinary/delete";
import { uploadMultipleImageFiles } from "@/lib/cloudinary/upload";
import { buildClientDeliveryUrl } from "@/lib/cloudinary/transformations";
import { ApiError } from "@/lib/utils/api-error";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import {
  createReviewSchema,
  moderateReviewSchema,
  updateReviewSchema,
} from "@/lib/validators/review.validator";
import { assertDeliveredPurchaseEligibility, loadDeliveredOrderProductIds } from "@/lib/services/review-eligibility.service";
import { recomputeProductRatingSummary, getProductRatingSummary } from "@/lib/services/review-rating.service";

function displayNameFromUser(user) {
  if (!user?.name) return "Verified buyer";
  const first = String(user.name).trim().split(/\s+/)[0];
  return first || "Verified buyer";
}

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

export function toPublicReview(review, userDoc) {
  const doc = typeof review.toObject === "function" ? review.toObject() : review;
  return {
    _id: String(doc._id),
    productId: String(doc.product),
    orderId: String(doc.order),
    rating: doc.rating,
    title: doc.title ?? "",
    comment: doc.comment,
    images: (doc.images ?? []).map(mapReviewImage),
    verificationStatus: doc.verificationStatus,
    moderationStatus: doc.moderationStatus,
    moderationNote:
      doc.moderationStatus === REVIEW_MODERATION_STATUS.REJECTED ? doc.moderationNote ?? "" : "",
    helpfulCount: doc.helpfulCount ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    authorName: displayNameFromUser(userDoc),
    verifiedPurchase: doc.verificationStatus === REVIEW_VERIFICATION_STATUS.VERIFIED,
  };
}

export function toCustomerReview(review) {
  const base = toPublicReview(review, review.user);
  return {
    ...base,
    authorName: undefined,
  };
}

async function findOwnedReview(reviewId, userId) {
  if (!mongoose.isValidObjectId(reviewId)) return null;
  return Review.findOne({ _id: reviewId, user: userId }).populate("user", "name email");
}

export async function createOrUpdateCustomerReview(user, payload) {
  const parsed = createReviewSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const { productId, orderId, rating, title, comment } = parsed.data;
  await assertDeliveredPurchaseEligibility(orderId, user._id, productId);

  const productExists = await Product.exists({ _id: productId });
  if (!productExists) {
    throw new ApiError(404, "Product not found.");
  }

  const existing = await Review.findOne({ user: user._id, product: productId });
  if (existing) {
    await assertDeliveredPurchaseEligibility(orderId, user._id, productId);
    existing.rating = rating;
    existing.title = title ?? "";
    existing.comment = comment;
    existing.order = orderId;
    existing.verificationStatus = REVIEW_VERIFICATION_STATUS.VERIFIED;
    existing.moderationStatus = REVIEW_MODERATION_STATUS.PENDING;
    existing.moderationNote = "";
    existing.moderatedAt = null;
    existing.moderatedBy = null;
    await existing.save();
    return existing;
  }

  try {
    return await Review.create({
      user: user._id,
      product: productId,
      order: orderId,
      rating,
      title: title ?? "",
      comment,
      verificationStatus: REVIEW_VERIFICATION_STATUS.VERIFIED,
      moderationStatus: REVIEW_MODERATION_STATUS.PENDING,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "You already reviewed this product. Edit your existing review instead.");
    }
    throw error;
  }
}

export async function updateCustomerReview(reviewId, user, payload) {
  const parsed = updateReviewSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const review = await findOwnedReview(reviewId, user._id);
  if (!review) throw new ApiError(404, "Review not found.");

  await assertDeliveredPurchaseEligibility(String(review.order), user._id, String(review.product));

  if (parsed.data.rating !== undefined) review.rating = parsed.data.rating;
  if (parsed.data.title !== undefined) review.title = parsed.data.title;
  if (parsed.data.comment !== undefined) review.comment = parsed.data.comment;
  review.moderationStatus = REVIEW_MODERATION_STATUS.PENDING;
  review.moderationNote = "";
  review.moderatedAt = null;
  review.moderatedBy = null;
  await review.save();
  return review;
}

export async function deleteCustomerReview(reviewId, user) {
  const review = await findOwnedReview(reviewId, user._id);
  if (!review) throw new ApiError(404, "Review not found.");

  const wasApproved = review.moderationStatus === REVIEW_MODERATION_STATUS.APPROVED;
  const productId = review.product;
  const publicIds = (review.images ?? []).map((image) => image.publicId).filter(Boolean);

  await review.deleteOne();
  if (publicIds.length) {
    await deleteCloudinaryImages(publicIds).catch(() => undefined);
  }
  if (wasApproved) {
    await recomputeProductRatingSummary(productId);
  }
}

export async function uploadReviewImages(reviewId, user, files) {
  const review = await findOwnedReview(reviewId, user._id);
  if (!review) throw new ApiError(404, "Review not found.");

  if (!files?.length) {
    throw new ApiError(422, "Validation failed.", [{ field: "files", message: "At least one image is required." }]);
  }

  const remaining = MAX_REVIEW_IMAGES - (review.images?.length ?? 0);
  if (remaining <= 0) {
    throw new ApiError(409, `You can attach up to ${MAX_REVIEW_IMAGES} photos per review.`);
  }
  if (files.length > remaining) {
    throw new ApiError(422, "Validation failed.", [
      { field: "files", message: `You can add ${remaining} more photo(s) to this review.` },
    ]);
  }

  const { uploaded, failures } = await uploadMultipleImageFiles(files, {
    folder: CLOUDINARY_FOLDERS.reviews,
    filenamePrefix: `review-${review._id}`,
    tags: ["review", String(review.product)],
  });

  if (!uploaded.length) {
    throw new ApiError(502, failures[0]?.message ?? "Image upload failed.");
  }

  for (const image of uploaded) {
    review.images.push({
      publicId: image.publicId,
      url: image.url,
      secureUrl: image.secureUrl,
      alt: "Customer review photo",
      width: image.width,
      height: image.height,
      format: image.format,
      bytes: image.bytes,
    });
  }

  review.moderationStatus = REVIEW_MODERATION_STATUS.PENDING;
  await review.save();

  return { review, uploaded, failures };
}

export async function removeReviewImage(reviewId, user, imageId) {
  const review = await findOwnedReview(reviewId, user._id);
  if (!review) throw new ApiError(404, "Review not found.");

  const image = review.images.id(imageId);
  if (!image) throw new ApiError(404, "Review image not found.");

  const publicId = image.publicId;
  image.deleteOne();
  review.moderationStatus = REVIEW_MODERATION_STATUS.PENDING;
  await review.save();
  if (publicId) {
    await deleteCloudinaryImages([publicId]).catch(() => undefined);
  }
  return review;
}

export async function listPublicProductReviews(productId, searchParams) {
  if (!mongoose.isValidObjectId(productId)) {
    throw new ApiError(404, "Product not found.");
  }

  const { page, limit, skip } = parsePagination(searchParams);
  const sortKey = searchParams.get("sort") ?? PUBLIC_REVIEW_SORT.RECENT;
  const ratingFilter = searchParams.get("rating");
  const filter = {
    product: productId,
    moderationStatus: REVIEW_MODERATION_STATUS.APPROVED,
  };
  if (ratingFilter) {
    const rating = Number(ratingFilter);
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
      filter.rating = rating;
    }
  }
  if (sortKey === PUBLIC_REVIEW_SORT.PHOTOS) {
    filter["images.0"] = { $exists: true };
  }

  let sort = { createdAt: -1 };
  if (sortKey === PUBLIC_REVIEW_SORT.HIGHEST) sort = { rating: -1, createdAt: -1 };
  if (sortKey === PUBLIC_REVIEW_SORT.LOWEST) sort = { rating: 1, createdAt: -1 };

  const [reviews, total, summary] = await Promise.all([
    Review.find(filter).sort(sort).skip(skip).limit(limit).populate("user", "name"),
    Review.countDocuments(filter),
    getProductRatingSummary(productId),
  ]);

  return {
    items: reviews.map((review) => toPublicReview(review, review.user)),
    summary,
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function listCustomerReviews(user, searchParams) {
  const { page, limit, skip } = parsePagination(searchParams);
  const filter = { user: user._id };

  const moderationStatus = searchParams.get("moderationStatus");
  if (
    moderationStatus &&
    Object.values(REVIEW_MODERATION_STATUS).includes(moderationStatus)
  ) {
    filter.moderationStatus = moderationStatus;
  }

  const sortKey = searchParams.get("sort") ?? "newest";
  let sort = { updatedAt: -1 };
  if (sortKey === "oldest") sort = { updatedAt: 1 };
  if (sortKey === "highest") sort = { rating: -1, updatedAt: -1 };
  if (sortKey === "lowest") sort = { rating: 1, updatedAt: -1 };

  const [reviews, total] = await Promise.all([
    Review.find(filter).sort(sort).skip(skip).limit(limit).populate("product", "name slug images"),
    Review.countDocuments(filter),
  ]);

  return {
    items: reviews.map((review) => {
      const productDoc = review.product;
      const image = productDoc?.images?.[0];
      return {
        ...toCustomerReview(review),
        productName: productDoc?.name ?? "",
        productSlug: productDoc?.slug ?? "",
        productImageUrl: image?.secureUrl || image?.url || "",
      };
    }),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getOrderReviewContext(user, orderIds) {
  const orders = await loadDeliveredOrderProductIds(String(user._id), orderIds);
  const productIds = [];
  for (const order of orders) {
    for (const item of order.items) {
      productIds.push(String(item.product));
    }
  }
  const uniqueProductIds = [...new Set(productIds)];

  const reviews = uniqueProductIds.length
    ? await Review.find({ user: user._id, product: { $in: uniqueProductIds } }).lean()
    : [];
  const reviewByProduct = new Map(reviews.map((review) => [String(review.product), review]));

  /** @type {Record<string, Record<string, unknown>>} */
  const byOrder = {};
  for (const order of orders) {
    const orderKey = String(order._id);
    byOrder[orderKey] = {};
    for (const item of order.items) {
      const productKey = String(item.product);
      const existing = reviewByProduct.get(productKey);
      byOrder[orderKey][productKey] = {
        productId: productKey,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        imageUrl: item.imageUrl ?? "",
        eligible: true,
        review: existing
          ? {
              _id: String(existing._id),
              rating: existing.rating,
              title: existing.title ?? "",
              comment: existing.comment ?? "",
              moderationStatus: existing.moderationStatus,
              updatedAt: existing.updatedAt,
            }
          : null,
      };
    }
  }
  return byOrder;
}

export async function listAdminReviews(searchParams) {
  const { page, limit, skip } = parsePagination(searchParams);
  const moderationStatus = searchParams.get("moderationStatus");
  const q = searchParams.get("q")?.trim();

  const filter = {};
  if (moderationStatus && Object.values(REVIEW_MODERATION_STATUS).includes(moderationStatus)) {
    filter.moderationStatus = moderationStatus;
  }
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { comment: new RegExp(escaped, "i") },
      { title: new RegExp(escaped, "i") },
    ];
  }

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email companyName")
      .populate("product", "name slug sku")
      .populate("order", "orderNumber orderStatus"),
    Review.countDocuments(filter),
  ]);

  return {
    items: reviews.map((review) => ({
      ...toPublicReview(review, review.user),
      customerEmail: review.user?.email ?? "",
      customerName: review.user?.name ?? "",
      productName: review.product?.name ?? "",
      productSlug: review.product?.slug ?? "",
      orderNumber: review.order?.orderNumber ?? "",
    })),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function moderateReview(reviewId, adminUser, payload) {
  const parsed = moderateReviewSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  if (!mongoose.isValidObjectId(reviewId)) {
    throw new ApiError(404, "Review not found.");
  }

  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, "Review not found.");

  const previousStatus = review.moderationStatus;
  review.moderationStatus = parsed.data.moderationStatus;
  review.moderationNote = parsed.data.moderationNote ?? "";
  review.moderatedAt = new Date();
  review.moderatedBy = adminUser._id;
  await review.save();

  if (
    previousStatus !== parsed.data.moderationStatus &&
    (previousStatus === REVIEW_MODERATION_STATUS.APPROVED ||
      parsed.data.moderationStatus === REVIEW_MODERATION_STATUS.APPROVED)
  ) {
    await recomputeProductRatingSummary(review.product);
  }

  return review;
}

export async function deleteAdminReview(reviewId) {
  if (!mongoose.isValidObjectId(reviewId)) {
    throw new ApiError(404, "Review not found.");
  }
  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, "Review not found.");

  const wasApproved = review.moderationStatus === REVIEW_MODERATION_STATUS.APPROVED;
  const productId = review.product;
  const publicIds = (review.images ?? []).map((image) => image.publicId).filter(Boolean);
  await review.deleteOne();
  if (publicIds.length) {
    await deleteCloudinaryImages(publicIds).catch(() => undefined);
  }
  if (wasApproved) {
    await recomputeProductRatingSummary(productId);
  }
}
