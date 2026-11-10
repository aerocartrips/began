"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquareText, X } from "lucide-react";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Select, { type SelectOption } from "@/components/ui/form/select";
import RatingDistribution from "@/components/reviews/rating-distribution";
import RatingStars from "@/components/reviews/rating-stars";
import ReviewCard from "@/components/reviews/review-card";
import { ReviewListSkeleton } from "@/components/reviews/review-skeleton";
import { fetchProductReviews } from "@/features/reviews/review-api";
import { PUBLIC_REVIEW_PAGE_SIZE } from "@/lib/constants/review-status";
import { formatNumber } from "@/lib/format";
import type { ProductRatingSummary, PublicReview } from "@/features/reviews/types";

const SORT_OPTIONS: SelectOption[] = [
  { id: "recent", label: "Most recent" },
  { id: "highest", label: "Highest rated" },
  { id: "lowest", label: "Lowest rated" },
  { id: "photos", label: "With photos" },
];
const DEFAULT_QUERY = { sort: "recent", rating: "" };

type ReviewQuery = typeof DEFAULT_QUERY;
type ReviewList = { reviews: PublicReview[]; total: number; page: number };

type ProductReviewsSectionProps = {
  productId: string;
  salesMode: "wholesale" | "retail";
  /** Approved-review summary, from the product (the same figures as the rating under the title). */
  summary: { average: number; count: number; distribution: ProductRatingSummary["distribution"] };
  /** First page (newest first), rendered with the page. */
  initialReviews: PublicReview[];
  initialTotal: number;
};

/**
 * Ratings overview and the review list. The first page arrives with the
 * product page; sorting, filtering by star and "Show more" fetch from the
 * reviews API, and only the latest request is kept.
 */
export default function ProductReviewsSection({ productId, salesMode, summary, initialReviews, initialTotal }: ProductReviewsSectionProps) {
  const [query, setQuery] = useState<ReviewQuery>(DEFAULT_QUERY);
  const [list, setList] = useState<ReviewList>({ reviews: initialReviews, total: initialTotal, page: 1 });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  /** The last list requested, so "Try again" repeats exactly that. */
  const lastRequestRef = useRef({ query: DEFAULT_QUERY, page: 1 });

  useEffect(() => {
    const request = requestRef;
    return () => request.current?.abort();
  }, []);

  async function load(next: ReviewQuery, page: number) {
    requestRef.current?.abort();
    lastRequestRef.current = { query: next, page };
    setFailed(false);
    if (page === 1 && next.sort === DEFAULT_QUERY.sort && !next.rating) {
      // Back to the default view: the page already has it.
      setLoading(false);
      setList({ reviews: initialReviews, total: initialTotal, page: 1 });
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const result = await fetchProductReviews(
        productId,
        { sort: next.sort, rating: next.rating || undefined, page: String(page), limit: String(PUBLIC_REVIEW_PAGE_SIZE) },
        { signal: controller.signal },
      );
      const reviews = result.data?.reviews ?? [];
      const total = Number((result.meta as { total?: number } | null | undefined)?.total ?? reviews.length);
      setList((current) => ({ reviews: page > 1 ? [...current.reviews, ...reviews] : reviews, total, page }));
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }

  function change(patch: Partial<ReviewQuery>) {
    const next = { ...query, ...patch };
    setQuery(next);
    void load(next, 1);
  }

  const hasMore = list.reviews.length < list.total;
  const audience = salesMode === "wholesale" ? "verified wholesale buyers" : "verified buyers";

  return (
    <section className="product-reviews" id="product-reviews" aria-labelledby="reviews-heading">
      <div className="product-reviews__header">
        <h2 id="reviews-heading" className="product-section-title">Customer reviews</h2>
        <p>Ratings and feedback from {audience}.</p>
      </div>

      {summary.count === 0 ? (
        <div className="product-reviews__empty">
          <span className="product-reviews__empty-icon" aria-hidden="true">
            <MessageSquareText size={22} />
          </span>
          <div>
            <h3>No reviews yet</h3>
            <p>
              Buyers can rate this product once their order is delivered.{" "}
              <Link href="/account/orders">Review a delivered order</Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="product-reviews__layout">
          <aside className="product-reviews__summary" aria-label="Rating summary">
            <p className="product-reviews__score">
              <strong>{summary.average.toFixed(1)}</strong>
              <span>out of 5</span>
            </p>
            <RatingStars value={summary.average} size="md" />
            <p className="product-reviews__basis">
              Based on {formatNumber(summary.count)} {summary.count === 1 ? "review" : "reviews"}
            </p>
            <RatingDistribution
              distribution={summary.distribution}
              total={summary.count}
              selected={query.rating}
              onSelect={(rating) => change({ rating })}
            />
            <p className="product-reviews__cta">
              Bought this product? <Link href="/account/orders">Review it from your orders</Link>
            </p>
          </aside>

          <div className="product-reviews__main">
            <div className="product-reviews__toolbar">
              <p className="product-reviews__showing" aria-live="polite">
                {query.rating ? (
                  <button type="button" className="product-reviews__chip" onClick={() => change({ rating: "" })}>
                    {query.rating} {query.rating === "1" ? "star" : "stars"} <X size={14} aria-hidden="true" />
                    <span className="sr-only">: clear filter</span>
                  </button>
                ) : null}
                {loading ? "Loading reviews…" : `${formatNumber(list.total)} ${list.total === 1 ? "review" : "reviews"}`}
              </p>
              <Select
                className="product-reviews__sort"
                label="Sort reviews"
                hideLabel
                options={SORT_OPTIONS}
                value={query.sort}
                onChange={(sort) => change({ sort })}
              />
            </div>

            {failed ? (
              <ErrorCard
                title="Unable to load reviews"
                description="Check your connection and try again."
                action={
                  <LoadingButton
                    type="button"
                    size="sm"
                    onClick={() => void load(lastRequestRef.current.query, lastRequestRef.current.page)}
                  >
                    Try again
                  </LoadingButton>
                }
              />
            ) : null}

            {list.reviews.length > 0 ? (
              <div className="review-list" aria-busy={loading || undefined} data-loading={loading && list.page === 1 ? "" : undefined}>
                {list.reviews.map((review) => (
                  <ReviewCard key={review._id} review={review} />
                ))}
              </div>
            ) : loading ? (
              <ReviewListSkeleton />
            ) : !failed ? (
              <p className="product-reviews__none">No reviews match this filter yet.</p>
            ) : null}

            {hasMore && !failed ? (
              <LoadingButton
                type="button"
                variant="secondary"
                size="sm"
                className="review-load-more"
                loading={loading}
                onClick={() => void load(query, list.page + 1)}
              >
                Show more reviews
              </LoadingButton>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
