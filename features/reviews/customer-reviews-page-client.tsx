"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import ErrorCard from "@/components/ui/feedback/error-card";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Select, { type SelectOption } from "@/components/ui/form/select";
import ReviewCard from "@/components/reviews/review-card";
import ReviewStatusBadge from "@/components/reviews/review-status-badge";
import ReviewModal from "@/components/reviews/review-modal";
import { ReviewListSkeleton } from "@/components/reviews/review-skeleton";
import { apiRequest } from "@/lib/api/api-client";
import { deleteReview } from "@/features/reviews/review-api";
import type { PublicReview } from "@/features/reviews/types";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { isUnauthorizedError } from "@/lib/api/api-error";
import { authHref } from "@/lib/auth/redirect";

const FILTERS: SelectOption[] = [
  { id: "", label: "All reviews" },
  { id: "pending", label: "Pending approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const SORTS: SelectOption[] = [
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
        // The account layout verified the session on the server; the API answers 401 if it ends.
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
      } catch (failure) {
        if (isUnauthorizedError(failure)) {
          router.replace(authHref("/account/reviews"));
          return;
        }
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
    <div className="account-page">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Wholesale account</p>
          <h1>My Reviews</h1>
          <p className="account-lead">Track moderation status and update your verified purchase feedback.</p>
        </div>
        {total ? <p className="orders-count">{total} {total === 1 ? "review" : "reviews"}</p> : null}
      </div>

      <div className="account-filters account-filters--compact">
        <Select className="account-field" label="Status" options={FILTERS} value={moderationStatus} onChange={setModerationStatus} />
        <Select className="account-field" label="Sort" options={SORTS} value={sort} onChange={setSort} />
      </div>

      {loading && reviews.length === 0 ? <ReviewListSkeleton /> : null}
      {error ? (
        <ErrorCard title="Unable to load reviews" description={error} action={<LoadingButton type="button" size="sm" onClick={() => void load(1, false)}>Try again</LoadingButton>} />
      ) : null}
      {!loading && !error && reviews.length === 0 ? (
        <EmptyState
          className="account-empty"
          icon={<Star size={20} />}
          title="No reviews yet"
          description="Once an order is delivered, you can rate each product from My Orders."
          action={<Button href="/account/orders" size="sm">Go to my orders</Button>}
        />
      ) : null}

      <div className="customer-review-list">
        {reviews.map((review) => (
          <article className="customer-review-card" key={review._id}>
            <header className="customer-review-card-head">
              <div>
                {review.productSlug ? (
                  <Link className="customer-review-product" href={`/products/${review.productSlug}`}>
                    {review.productName ?? "Product"}
                  </Link>
                ) : (
                  <span className="customer-review-product">{review.productName ?? "Product"}</span>
                )}
                {review.orderNumber ? <small>Order {review.orderNumber}</small> : null}
              </div>
              <ReviewStatusBadge status={review.moderationStatus ?? "pending"} />
            </header>
            <ReviewCard review={{ ...review, authorName: "You", verifiedPurchase: true }} showModeration={false} />
            <footer className="customer-review-actions">
              {review.productSlug ? (
                <Button href={`/products/${review.productSlug}`} variant="secondary" size="sm">View product</Button>
              ) : null}
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditReview(review)}>Edit review</Button>
              <button type="button" className="text-button text-button--danger" onClick={() => void removeReview(review._id)}>
                Delete
              </button>
            </footer>
          </article>
        ))}
      </div>

      {hasMore ? (
        <div className="account-load-more">
          <LoadingButton type="button" variant="secondary" size="sm" loading={loading} onClick={() => setPage((value) => value + 1)}>
            Load more reviews
          </LoadingButton>
        </div>
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
    </div>
  );
}
