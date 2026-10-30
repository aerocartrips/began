import RatingStars from "@/components/reviews/RatingStars";
import type { ProductRatingSummary } from "@/features/reviews/types";

type ProductRatingSummaryProps = {
  summary: ProductRatingSummary;
  compact?: boolean;
  onClickScroll?: () => void;
};

export default function ProductRatingSummary({
  summary,
  compact = false,
  onClickScroll,
}: ProductRatingSummaryProps) {
  if (summary.totalReviews === 0) {
    return <p className="product-rating-empty">No reviews yet</p>;
  }

  const content = (
    <>
      <RatingStars value={summary.averageRating} size={compact ? "sm" : "md"} />
      <span className="product-rating-score">
        {summary.averageRating.toFixed(1)} <small>({summary.totalReviews} reviews)</small>
      </span>
    </>
  );

  if (onClickScroll) {
    return (
      <button type="button" className="product-rating-summary product-rating-link" onClick={onClickScroll}>
        {content}
      </button>
    );
  }

  return <div className="product-rating-summary">{content}</div>;
}
