"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import RatingStars from "@/components/reviews/rating-stars";
import ReviewStatusBadge from "@/components/reviews/review-status-badge";
import ReviewModal from "@/components/reviews/review-modal";
import type { OrderProductReviewContext } from "@/features/reviews/types";

type OrderProductReviewActionProps = {
  orderId: string;
  context: OrderProductReviewContext;
  onUpdated: () => void;
};

export default function OrderProductReviewAction({
  orderId,
  context,
  onUpdated,
}: OrderProductReviewActionProps) {
  const [open, setOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const review = context.review;

  return (
    <div className="order-product-review">
      <div className="order-product-review-head">
        <strong>{context.productName}</strong>
        <span className="order-product-review-meta">Delivered · {context.quantity} units</span>
      </div>
      {review ? (
        <div className="order-product-review-existing">
          <RatingStars value={review.rating} size="sm" />
          <ReviewStatusBadge status={review.moderationStatus} />
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Edit review
          </Button>
        </div>
      ) : (
        <div className="order-product-review-new">
          <span className="order-product-review-prompt">Rate this product</span>
          <div
            className="order-product-review-stars"
            onMouseLeave={() => setHoverRating(0)}
          >
            <RatingStars
              value={hoverRating}
              interactive
              size="md"
              onChange={(value) => {
                setHoverRating(value);
                setOpen(true);
              }}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Write a review
          </Button>
        </div>
      )}
      <ReviewModal
        open={open}
        onClose={() => setOpen(false)}
        orderId={orderId}
        productId={context.productId}
        productName={context.productName}
        existing={review}
        onSubmitted={onUpdated}
      />
    </div>
  );
}
