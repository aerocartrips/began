export type ReviewModerationStatus = "pending" | "approved" | "rejected";

export type ReviewImage = {
  _id: string;
  publicId?: string;
  url: string;
  thumbnailUrl?: string;
  alt?: string;
  width?: number;
  height?: number;
};

export type CustomerReviewSnapshot = {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  moderationStatus: ReviewModerationStatus;
  updatedAt?: string;
};

export type OrderProductReviewContext = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  imageUrl: string;
  eligible: boolean;
  review: CustomerReviewSnapshot | null;
};

export type OrderReviewContextMap = Record<string, Record<string, OrderProductReviewContext>>;

export type ProductRatingSummary = {
  averageRating: number;
  totalReviews: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
};

export type PublicReview = {
  _id: string;
  productId: string;
  orderId?: string;
  rating: number;
  title: string;
  comment: string;
  images: ReviewImage[];
  verificationStatus: string;
  moderationStatus?: ReviewModerationStatus;
  moderationNote?: string;
  helpfulCount: number;
  createdAt: string;
  updatedAt?: string;
  authorName?: string;
  verifiedPurchase: boolean;
  productName?: string;
  productSlug?: string;
  productImageUrl?: string;
  customerEmail?: string;
  customerName?: string;
  orderNumber?: string;
};

export type ReviewFormPayload = {
  productId: string;
  orderId: string;
  rating: number;
  title?: string;
  comment: string;
};
