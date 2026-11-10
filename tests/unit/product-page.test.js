import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { purchaseTerms } from "@/lib/catalog/purchase-terms";
import { toPublicReview, toStorefrontReview } from "@/lib/services/review-dto";
import { REVIEW_MODERATION_STATUS, REVIEW_VERIFICATION_STATUS } from "@/lib/constants/review-status";

const POLICIES = { returnWindowDays: 7, shippingFlatAmount: 1000, shippingFreeThreshold: 1000, lowStockThreshold: 5 };
const STORE = { salesMode: "wholesale", paymentsEnabled: true, hasGstin: false };

describe("purchase terms on the product page", () => {
  it("describes only what the store's settings promise", () => {
    const terms = purchaseTerms(POLICIES, STORE);
    expect(terms.map((term) => term.key)).toEqual(["payments", "shipping", "returns"]);
    expect(terms[1].title).toBe("Free shipping over ₹1,000");
    expect(terms[1].detail).toBe("₹1,000 flat on smaller orders.");
    expect(terms[2].title).toBe("7-day returns");
  });

  it("follows the shipping rules used at checkout", () => {
    expect(purchaseTerms({ ...POLICIES, shippingFlatAmount: 0 }, STORE)[1].title).toBe("Free shipping");
    expect(purchaseTerms({ ...POLICIES, shippingFreeThreshold: 0 }, STORE)[1]).toMatchObject({
      title: "Flat-rate shipping",
      detail: "₹1,000 per order.",
    });
  });

  it("leaves out returns, payments and invoices the store does not offer", () => {
    const terms = purchaseTerms({ ...POLICIES, returnWindowDays: 0 }, { ...STORE, paymentsEnabled: false });
    expect(terms.map((term) => term.key)).toEqual(["shipping"]);
    expect(purchaseTerms(POLICIES, { ...STORE, hasGstin: true }).at(-1)).toMatchObject({ key: "invoice", title: "GST invoice" });
  });
});

describe("review DTOs", () => {
  const productId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const review = {
    _id: new mongoose.Types.ObjectId(),
    // Populated references, as in the account and admin listings.
    product: { _id: productId, name: "Banarasi saree" },
    order: { _id: orderId, orderNumber: "NS-1001" },
    rating: 5,
    title: "Lovely",
    comment: "Beautiful zari and a soft drape.",
    images: [],
    verificationStatus: REVIEW_VERIFICATION_STATUS.VERIFIED,
    moderationStatus: REVIEW_MODERATION_STATUS.APPROVED,
    helpfulCount: 3,
    createdAt: new Date("2026-10-01T10:00:00Z"),
  };

  it("keeps ids as ids when references are populated", () => {
    const dto = toPublicReview(review, { name: "Priya Sharma" });
    expect(dto.productId).toBe(String(productId));
    expect(dto.orderId).toBe(String(orderId));
    expect(dto.authorName).toBe("Priya");
    expect(dto.createdAt).toBe("2026-10-01T10:00:00.000Z");
  });

  it("never shows shoppers the reviewer's order", () => {
    const dto = toStorefrontReview({ ...review, product: productId, order: orderId }, null);
    expect(dto).not.toHaveProperty("orderId");
    expect(dto.authorName).toBe("Verified buyer");
    expect(dto.verifiedPurchase).toBe(true);
  });
});
