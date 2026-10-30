"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import EmptyState from "@/components/ui/empty-state";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import TableSkeleton from "@/components/ui/loaders/TableSkeleton";
import ReviewStatusBadge from "@/components/reviews/ReviewStatusBadge";
import RatingStars from "@/components/reviews/RatingStars";
import { useApiRequest } from "@/hooks/useApiRequest";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { deleteReviewAdmin, moderateReviewAdmin } from "@/features/reviews/review-api";
import type { PublicReview } from "@/features/reviews/types";

const FILTERS = [
  { id: "", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export default function AdminReviewsClient() {
  const feedback = useFeedback();
  const [moderationStatus, setModerationStatus] = useState("");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState("");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (moderationStatus) params.set("moderationStatus", moderationStatus);
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "30");
    return `/api/v1/admin/reviews?${params.toString()}`;
  }, [moderationStatus, q]);

  const listRequest = useApiRequest<PublicReview[]>(endpoint);
  const reviews = listRequest.data ?? [];

  async function moderate(reviewId: string, status: "approved" | "rejected") {
    setBusyId(reviewId);
    try {
      await moderateReviewAdmin(reviewId, status);
      feedback.success("Review updated", status === "approved" ? "Review is now public." : "Review rejected.");
      await listRequest.refetch();
    } catch (error) {
      feedback.error("Moderation failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(reviewId: string) {
    if (!window.confirm("Delete this review permanently?")) return;
    setBusyId(reviewId);
    try {
      await deleteReviewAdmin(reviewId);
      feedback.success("Review deleted", "The review was removed.");
      await listRequest.refetch();
    } catch (error) {
      feedback.error("Delete failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="admin-page">
      <AdminPageHeading
        eyebrow="Catalog quality"
        title="Product reviews"
        description="Moderate verified purchase reviews before they appear on product pages."
      />

      <div className="orders-toolbar">
        <label>
          Search
          <input value={q} onChange={(event) => setQ(event.currentTarget.value)} placeholder="Product, customer, text" />
        </label>
        <label>
          Status
          <select value={moderationStatus} onChange={(event) => setModerationStatus(event.currentTarget.value)}>
            {FILTERS.map((filter) => (
              <option key={filter.id || "all"} value={filter.id}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
        <LoadingButton type="button" variant="secondary" loading={listRequest.loading} onClick={() => void listRequest.refetch()}>
          Apply
        </LoadingButton>
      </div>

      {listRequest.loading && reviews.length === 0 ? <TableSkeleton rows={6} /> : null}
      {listRequest.error ? (
        <ErrorCard
          title="Unable to load reviews"
          description={listRequest.error}
          action={<LoadingButton type="button" onClick={() => void listRequest.refetch()}>Try again</LoadingButton>}
        />
      ) : null}
      {!listRequest.loading && reviews.length === 0 ? (
        <EmptyState title="No reviews found" description="Customer reviews appear here after submission." />
      ) : null}

      <div className="admin-review-list">
        {reviews.map((review) => (
          <article className="admin-review-card" key={review._id}>
            <header>
              <div>
                <strong>{review.productName ?? "Product"}</strong>
                <small>{review.customerName} · {review.customerEmail}</small>
                {review.orderNumber ? (
                  <Link className="admin-text-link" href={`/admin/orders/${review.orderId}`}>
                    Order {review.orderNumber}
                  </Link>
                ) : null}
              </div>
              <ReviewStatusBadge status={review.moderationStatus ?? "pending"} />
            </header>
            <RatingStars value={review.rating} size="sm" />
            {review.title ? <h3>{review.title}</h3> : null}
            <p>{review.comment}</p>
            {review.images?.length ? (
              <div className="admin-review-photos">
                {review.images.map((image) => (
                  <a key={image._id} href={image.url} target="_blank" rel="noreferrer">
                    <Image src={image.thumbnailUrl || image.url} alt="" width={72} height={96} />
                  </a>
                ))}
              </div>
            ) : null}
            <div className="admin-review-actions">
              <LoadingButton
                type="button"
                loading={busyId === review._id}
                onClick={() => void moderate(review._id, "approved")}
              >
                Approve
              </LoadingButton>
              <LoadingButton
                type="button"
                variant="secondary"
                loading={busyId === review._id}
                onClick={() => void moderate(review._id, "rejected")}
              >
                Reject
              </LoadingButton>
              <LoadingButton
                type="button"
                variant="secondary"
                loading={busyId === review._id}
                onClick={() => void remove(review._id)}
              >
                Delete
              </LoadingButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
