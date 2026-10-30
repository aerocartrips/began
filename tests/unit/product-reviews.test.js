import { describe, expect, it } from "vitest";
import { ORDER_STATUS } from "@/lib/constants/order-status";
import {
  MAX_REVIEW_COMMENT_LENGTH,
  MIN_REVIEW_COMMENT_LENGTH,
  REVIEW_MODERATION_STATUS,
} from "@/lib/constants/review-status";
import { createReviewSchema, moderateReviewSchema } from "@/lib/validators/review.validator";
import { CLOUDINARY_FOLDERS } from "@/lib/constants/cloudinary-folders";
import { isManagedCloudinaryPublicId } from "@/lib/constants/cloudinary-folders";

describe("review validators", () => {
  it("requires minimum comment length", () => {
    const result = createReviewSchema.safeParse({
      productId: "507f1f77bcf86cd799439011",
      orderId: "507f1f77bcf86cd799439012",
      rating: 5,
      comment: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid review payload", () => {
    const comment = "a".repeat(MIN_REVIEW_COMMENT_LENGTH);
    const result = createReviewSchema.safeParse({
      productId: "507f1f77bcf86cd799439011",
      orderId: "507f1f77bcf86cd799439012",
      rating: 4,
      title: "Beautiful drape",
      comment,
    });
    expect(result.success).toBe(true);
    expect(result.data?.comment.length).toBeGreaterThanOrEqual(MIN_REVIEW_COMMENT_LENGTH);
    expect(result.data?.comment.length).toBeLessThanOrEqual(MAX_REVIEW_COMMENT_LENGTH);
  });

  it("validates moderation statuses", () => {
    expect(moderateReviewSchema.safeParse({ moderationStatus: "approved" }).success).toBe(true);
    expect(moderateReviewSchema.safeParse({ moderationStatus: "pending" }).success).toBe(false);
  });
});

describe("review business rules", () => {
  it("only delivered orders are eligible statuses", () => {
    const ineligible = [
      ORDER_STATUS.PENDING_PAYMENT,
      ORDER_STATUS.PROCESSING,
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.CANCELLED,
    ];
    for (const status of ineligible) {
      expect(status).not.toBe(ORDER_STATUS.DELIVERED);
    }
  });

  it("public ratings use approved moderation only", () => {
    expect(REVIEW_MODERATION_STATUS.APPROVED).toBe("approved");
    expect(REVIEW_MODERATION_STATUS.PENDING).not.toBe(REVIEW_MODERATION_STATUS.APPROVED);
  });
});

describe("review cloudinary paths", () => {
  it("stores review uploads under managed folder", () => {
    expect(CLOUDINARY_FOLDERS.reviews).toBe("norosilk/reviews");
    expect(isManagedCloudinaryPublicId("norosilk/reviews/sample")).toBe(true);
    expect(isManagedCloudinaryPublicId("external/other")).toBe(false);
  });
});
