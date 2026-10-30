import type { ProductRatingSummary as Summary } from "@/features/reviews/types";

type RatingDistributionProps = {
  summary: Summary;
};

export default function RatingDistribution({ summary }: RatingDistributionProps) {
  const total = summary.totalReviews || 1;
  const rows = [5, 4, 3, 2, 1] as const;

  return (
    <div className="rating-distribution">
      {rows.map((star) => {
        const count = summary.distribution[star] ?? 0;
        const width = Math.round((count / total) * 100);
        return (
          <div key={star} className="rating-distribution-row">
            <span>{star} ★</span>
            <div className="rating-distribution-bar" aria-hidden="true">
              <span style={{ width: `${width}%` }} />
            </div>
            <span>{count}</span>
          </div>
        );
      })}
    </div>
  );
}
