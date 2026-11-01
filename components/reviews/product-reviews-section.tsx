"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/ui/empty-state";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ProductRatingSummary from "@/components/reviews/product-rating-summary";
import RatingDistribution from "@/components/reviews/rating-distribution";
import ReviewCard from "@/components/reviews/review-card";
import { ReviewListSkeleton } from "@/components/reviews/review-skeleton";
import { fetchProductReviews } from "@/features/reviews/review-api";
import type { ProductRatingSummary as Summary, PublicReview } from "@/features/reviews/types";

const SORT_OPTIONS = [
  { id: "recent", label: "Most recent" },
  { id: "highest", label: "Highest rated" },
  { id: "lowest", label: "Lowest rated" },
  { id: "photos", label: "Photo reviews" },
];

type ProductReviewsSectionProps = {
  productId: string;
};

export default function ProductReviewsSection({ productId }: ProductReviewsSectionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sort, setSort] = useState("recent");
  const [ratingFilter, setRatingFilter] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const query = useMemo(
    () => ({
      sort,
      rating: ratingFilter || undefined,
      page: String(page),
      limit: "8",
    }),
    [page, ratingFilter, sort],
  );

  const load = useCallback(
    async (append = false) => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchProductReviews(productId, query);
        const next = result.data?.reviews ?? [];
        setSummary(result.data?.summary ?? null);
        setReviews((current) => (append ? [...current, ...next] : next));
        const meta = result.meta as { page?: number; totalPages?: number } | null;
        if (meta?.page && meta?.totalPages) {
          setHasMore(meta.page < meta.totalPages);
        } else {
          setHasMore(next.length >= 8);
        }
      } catch {
        setError("Reviews are unavailable right now.");
      } finally {
        setLoading(false);
      }
    },
    [productId, query],
  );

  useEffect(() => {
    void load(page > 1); // eslint-disable-line react-hooks/set-state-in-effect -- fetch reviews when query changes
  }, [load, page]);

  return (
    <section className="product-reviews-section" id="product-reviews" aria-labelledby="reviews-heading">
      <div className="product-reviews-heading">
        <h2 id="reviews-heading">Customer reviews</h2>
        <p>Verified purchase feedback from wholesale buyers.</p>
      </div>
      {summary && summary.totalReviews > 0 ? (
        <div className="product-reviews-summary-grid">
          <div className="product-reviews-overview">
            <strong className="product-reviews-average">{summary.averageRating.toFixed(1)}</strong>
            <ProductRatingSummary summary={summary} />
            <RatingDistribution summary={summary} />
          </div>
          <div className="product-reviews-filters">
            <label className="account-field">
              Sort
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.currentTarget.value);
                  setPage(1);
                }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="account-field">
              Rating
              <select
                value={ratingFilter}
                onChange={(event) => {
                  setRatingFilter(event.currentTarget.value);
                  setPage(1);
                }}
              >
                <option value="">All ratings</option>
                {[5, 4, 3, 2, 1].map((star) => (
                  <option key={star} value={String(star)}>
                    {star} stars
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {loading && reviews.length === 0 ? <ReviewListSkeleton /> : null}
      {error ? (
        <ErrorCard
          title="Unable to load reviews"
          description={error}
          action={<LoadingButton type="button" size="sm" onClick={() => void load(false)}>Try again</LoadingButton>}
        />
      ) : null}
      {!loading && !error && reviews.length === 0 ? (
        <EmptyState
          className="account-empty"
          title="No reviews yet"
          description="Buyers can review this saree once their order is delivered."
        />
      ) : null}

      <div className="review-list">
        {reviews.map((review) => (
          <ReviewCard key={review._id} review={review} />
        ))}
      </div>

      {hasMore ? (
        <LoadingButton
          type="button"
          variant="secondary"
          size="sm"
          className="review-load-more"
          loading={loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Load more reviews
        </LoadingButton>
      ) : null}
    </section>
  );
}
