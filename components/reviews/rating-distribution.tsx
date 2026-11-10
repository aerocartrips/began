import { formatNumber } from "@/lib/format";
import type { ProductRatingSummary as Summary } from "@/features/reviews/types";

const STARS = ["5", "4", "3", "2", "1"] as const;

type RatingDistributionProps = {
  distribution: Summary["distribution"];
  total: number;
  /** The star rating the review list is filtered to ("" for all). */
  selected: string;
  /** Pressing a row filters the reviews to that rating; pressing it again clears it. */
  onSelect: (star: string) => void;
};

/** Share of reviews per star rating, one bar per rating; each bar filters the list. */
export default function RatingDistribution({ distribution, total, selected, onSelect }: RatingDistributionProps) {
  return (
    <ul className="rating-distribution" aria-label="Filter reviews by rating">
      {STARS.map((star) => {
        const count = distribution[star] ?? 0;
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li key={star}>
            <button
              type="button"
              className="rating-distribution-row"
              aria-pressed={selected === star}
              disabled={count === 0}
              aria-label={`${star} star: ${formatNumber(count)} ${count === 1 ? "review" : "reviews"} (${percent}%)`}
              onClick={() => onSelect(selected === star ? "" : star)}
            >
              <span className="rating-distribution-label">{star} ★</span>
              <span className="rating-distribution-bar" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </span>
              <span className="rating-distribution-count">{formatNumber(count)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
