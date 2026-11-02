import { describe, expect, it, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { createTestTenant, enterTenantBeforeEach } from "../helpers/tenant.js";

let testTenantId;
enterTenantBeforeEach(() => testTenantId);

const testUri = process.env.MONGODB_URI_TEST?.trim();

describe.skipIf(!testUri)("Admin operations integration", () => {
  beforeAll(async () => {
    process.env.MONGODB_URI = testUri;
    const { connectDB } = await import("@/lib/db/connect");
    await connectDB();
    ({ tenantId: testTenantId } = await createTestTenant());
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("creates store settings document with defaults", async () => {
    const { getStoreSettingsDocument } = await import("@/lib/db/models/StoreSettings");
    const doc = await getStoreSettingsDocument();
    expect(doc.general.storeName).toBeTruthy();
    expect(doc.shipping.defaultWeightKg).toBeGreaterThan(0);
  });

  it("records helpful votes atomically", async () => {
    const { Review } = await import("@/lib/db/models/Review");
    const { ReviewVote } = await import("@/lib/db/models/ReviewVote");
    const { User } = await import("@/lib/db/models/User");
    const { markReviewHelpful } = await import("@/lib/services/review-helpful.service");
    const { REVIEW_MODERATION_STATUS } = await import("@/lib/constants/review-status");

    const author = await User.create({
      name: "Author",
      email: `author-${Date.now()}@norosilk.test`,
      password: "x".repeat(60),
    });
    const voter = await User.create({
      name: "Voter",
      email: `voter-${Date.now()}@norosilk.test`,
      password: "x".repeat(60),
    });
    const review = await Review.create({
      customer: author._id,
      product: new mongoose.Types.ObjectId(),
      order: new mongoose.Types.ObjectId(),
      rating: 5,
      title: "Great",
      comment: "Quality saree",
      moderationStatus: REVIEW_MODERATION_STATUS.APPROVED,
      helpfulCount: 0,
    });

    const first = await markReviewHelpful(String(review._id), voter);
    expect(first.helpfulCount).toBe(1);
    const second = await markReviewHelpful(String(review._id), voter);
    expect(second.helpfulCount).toBe(1);

    await ReviewVote.deleteMany({ review: review._id });
    await Review.deleteOne({ _id: review._id });
    await User.deleteMany({ _id: { $in: [author._id, voter._id] } });
  });
});
