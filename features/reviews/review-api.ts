import { apiRequest } from "@/lib/api/api-client";
import type {
  OrderReviewContextMap,
  ProductRatingSummary,
  PublicReview,
  ReviewFormPayload,
} from "@/features/reviews/types";

export async function fetchOrderReviewContext(orderIds: string[]) {
  return apiRequest<OrderReviewContextMap>("/api/v1/reviews/order-context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderIds }),
  });
}

export async function submitReview(payload: ReviewFormPayload) {
  return apiRequest<PublicReview>("/api/v1/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateReview(reviewId: string, payload: Partial<ReviewFormPayload>) {
  return apiRequest<PublicReview>(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadReviewImages(reviewId: string, files: File[]) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  return apiRequest<{ review: PublicReview }>(`/api/v1/reviews/${encodeURIComponent(reviewId)}/images`, {
    method: "POST",
    body: formData,
  });
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchProductReviews(productId: string, params: Record<string, string | undefined>) {
  return apiRequest<{ reviews: PublicReview[]; summary: ProductRatingSummary }>(
    `/api/v1/products/${encodeURIComponent(productId)}/reviews${buildQuery(params)}`,
  );
}

export async function moderateReviewAdmin(
  reviewId: string,
  moderationStatus: "approved" | "rejected",
  moderationNote?: string,
) {
  return apiRequest(`/api/v1/admin/reviews/${encodeURIComponent(reviewId)}/moderate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moderationStatus, moderationNote }),
  });
}

export async function deleteReview(reviewId: string) {
  return apiRequest(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
}

export async function deleteReviewAdmin(reviewId: string) {
  return apiRequest(`/api/v1/admin/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
}
