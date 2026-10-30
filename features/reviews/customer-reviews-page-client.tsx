"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/ui/empty-state";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import ReviewCard from "@/components/reviews/ReviewCard";
import ReviewStatusBadge from "@/components/reviews/ReviewStatusBadge";
import ReviewModal from "@/components/reviews/ReviewModal";
import { ReviewListSkeleton } from "@/components/reviews/ReviewSkeleton";
import { apiRequest } from "@/lib/api/api-client";
import { deleteReview } from "@/features/reviews/review-api";
import type { PublicReview } from "@/features/reviews/types";
import { fetchCurrentCustomer } from "@/features/checkout/submit-checkout-order";
import { useFeedback } from "@/components/feedback/FeedbackProvider";

const FILTERS = [
  { id: "", label: "All reviews" },
  { id: "pending", label: "Pending approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "highest", label: "Highest rated" },
  { id: "lowest", label: "Lowest rated" },
];

async function fetchMyReviews(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return apiRequest<PublicReview[]>(`/api/v1/account/reviews?${search.toString()}`);
}

export default function CustomerReviewsPageClient() {
  const router = useRouter();
  const feedback = useFeedback();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [moderationStatus, setModerationStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [editReview, setEditReview] = useState<PublicReview | null>(null);

  const filterKey = useMemo(() => `${moderationStatus}|${sort}`, [moderationStatus, sort]);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      setLoading(true);
      setError("");
      try {
        const customer = await fetchCurrentCustomer();
        if (!customer) {
          router.push("/account/login?next=/account/reviews");
          return;
        }
        const result = await fetchMyReviews({
          page: String(targetPage),
          limit: "10",
          moderationStatus: moderationStatus || undefined,
          sort,
        });
        const next = result.data ?? [];
        setReviews((current) => {
          if (!append) return next;
          const seen = new Set(current.map((item) => item._id));
          return [...current, ...next.filter((item) => !seen.has(item._id))];
        });
        const meta = result.meta as { page?: number; totalPages?: number; total?: number } | null;
        setTotal(meta?.total ?? next.length);
        if (meta?.page && meta?.totalPages) setHasMore(meta.page < meta.totalPages);
        else setHasMore(next.length >= 10);
      } catch {
        setError("We could not load your reviews.");
      } finally {
        setLoading(false);
      }
    },
    [moderationStatus, router, sort],
  );

  useEffect(() => {
    setPage(1); // eslint-disable-line react-hooks/set-state-in-effect -- reset pagination when filters change
  }, [filterKey]);

  useEffect(() => {
    void load(page, page > 1); // eslint-disable-line react-hooks/set-state-in-effect -- paginated review fetch
  }, [filterKey, page, load]);

  async function removeReview(reviewId: string) {
    if (!window.confirm("Remove this review permanently?")) return;
    try {
      await deleteReview(reviewId);
      feedback.success("Review removed", "Your review was deleted.");
      setPage(1);
      await load(1, false);
    } catch (error) {
      feedback.error("Could not delete review", error instanceof Error ? error.message : "Try again.");
    }
  }

  return (
    <main className="commerce-page content-width orders-page">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Wholesale account</p>
          <h1>My Reviews</h1>
          <p className="orders-page-lead">Track moderation status and update verified purchase feedback.</p>
        </div>
        {total ? <p className="orders-count">{total} reviews</p> : null}
      </div>

      <div className="orders-toolbar">
        <label>
          Filter
          <select value={moderationStatus} onChange={(event) => setModerationStatus(event.currentTarget.value)}>
            {FILTERS.map((filter) => (
              <option key={filter.id || "all"} value={filter.id}>{filter.label}</option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.currentTarget.value)}>
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && reviews.length === 0 ? <ReviewListSkeleton /> : null}
      {error ? (
        <ErrorCard title="Unable to load reviews" description={error} action={<LoadingButton type="button" onClick={() => void load(1, false)}>Try again</LoadingButton>} />
      ) : null}
      {!loading && !error && reviews.length === 0 ? (
        <EmptyState title="No reviews yet" description="After delivery, rate products from My Orders." action={<Button href="/products">Shop products</Button>} />
      ) : null}

      <div className="customer-review-list">
        {reviews.map((review) => (
          <article className="customer-review-card" key={review._id}>
            <div className="customer-review-card-head">
              {review.productSlug ? (
                <Link href={`/products/${review.productSlug}`}>
                  <strong>{review.productName ?? "Product"}</strong>
                </Link>
              ) : (
                <strong>{review.productName ?? "Product"}</strong>
              )}
              <ReviewStatusBadge status={review.moderationStatus ?? "pending"} />
            </div>
            <ReviewCard review={{ ...review, authorName: "You", verifiedPurchase: true }} showModeration={false} />
            <div className="customer-review-actions">
              {review.productSlug ? <Button href={`/products/${review.productSlug}`} variant="secondary">View product</Button> : null}
              <LoadingButton type="button" variant="secondary" onClick={() => setEditReview(review)}>Edit review</LoadingButton>
              <LoadingButton type="button" variant="secondary" onClick={() => void removeReview(review._id)}>Delete</LoadingButton>
            </div>
          </article>
        ))}
      </div>

      {hasMore ? (
        <LoadingButton type="button" className="orders-load-more" loading={loading} onClick={() => setPage((value) => value + 1)}>
          Load more
        </LoadingButton>
      ) : null}

      {editReview ? (
        <ReviewModal
          open
          onClose={() => setEditReview(null)}
          orderId={editReview.orderId ?? ""}
          productId={editReview.productId}
          productName={editReview.productName ?? "Product"}
          existing={{
            _id: editReview._id,
            rating: editReview.rating,
            title: editReview.title,
            comment: editReview.comment,
            moderationStatus: editReview.moderationStatus ?? "pending",
          }}
          onSubmitted={() => {
            setEditReview(null);
            void load(1, false);
          }}
        />
      ) : null}
    </main>
  );
}
