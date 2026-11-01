"use client";

import { useEffect, useState } from "react";
import ProductRatingSummary from "@/components/reviews/product-rating-summary";
import { fetchProductReviews } from "@/features/reviews/review-api";
import type { ProductRatingSummary as Summary } from "@/features/reviews/types";

type ProductRatingInlineProps = {
  productId: string;
  onScrollToReviews?: () => void;
};

export default function ProductRatingInline({ productId, onScrollToReviews }: ProductRatingInlineProps) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchProductReviews(productId, { limit: "1", page: "1" }).then((result) => {
      if (!cancelled) setSummary(result.data?.summary ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!summary || summary.totalReviews === 0) {
    return <p className="product-rating-empty">Be the first to review</p>;
  }

  return (
    <ProductRatingSummary summary={summary} compact onClickScroll={onScrollToReviews} />
  );
}
