"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import Button from "@/components/ui/button";
import RatingStars from "@/components/reviews/RatingStars";
import ReviewImageUploader from "@/components/reviews/ReviewImageUploader";
import { MAX_REVIEW_IMAGES, MIN_REVIEW_COMMENT_LENGTH, MAX_REVIEW_COMMENT_LENGTH } from "@/lib/constants/review-status";
import { submitReview, updateReview, uploadReviewImages } from "@/features/reviews/review-api";
import type { CustomerReviewSnapshot } from "@/features/reviews/types";

type ReviewModalProps = {
  open: boolean;
  onClose: () => void;
  orderId: string;
  productId: string;
  productName: string;
  existing?: CustomerReviewSnapshot | null;
  onSubmitted: () => void;
};

export default function ReviewModal({
  open,
  onClose,
  orderId,
  productId,
  productName,
  existing,
  onSubmitted,
}: ReviewModalProps) {
  const feedback = useFeedback();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetAndClose = useCallback(() => {
    setFiles([]);
    setComment("");
    onClose();
  }, [onClose]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (rating < 1) {
      feedback.warning("Select a rating", "Choose 1 to 5 stars before submitting.");
      return;
    }
    if (comment.trim().length < MIN_REVIEW_COMMENT_LENGTH) {
      feedback.warning(
        "Review too short",
        `Please write at least ${MIN_REVIEW_COMMENT_LENGTH} characters.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      let reviewId = existing?._id;
      if (existing?._id) {
        const updated = await updateReview(existing._id, { rating, title, comment });
        reviewId = updated.data?._id ?? existing._id;
      } else {
        const created = await submitReview({ productId, orderId, rating, title, comment });
        reviewId = created.data?._id;
      }

      if (reviewId && files.length) {
        await uploadReviewImages(reviewId, files);
      }

      feedback.success(
        "Review submitted",
        "Thank you for sharing your experience! Your review has been submitted and is awaiting approval.",
      );
      onSubmitted();
      resetAndClose();
    } catch (error) {
      feedback.error("Could not submit review", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="review-modal-backdrop" role="presentation" onClick={resetAndClose}>
      <div
        className="review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="review-modal-head">
          <div>
            <p className="eyebrow">Verified purchase</p>
            <h2 id="review-modal-title">{existing ? "Edit review" : "Write a review"}</h2>
            <p>{productName}</p>
          </div>
          <button type="button" className="review-modal-close" onClick={resetAndClose}>
            Close
          </button>
        </header>
        <form className="review-modal-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Overall rating
            <RatingStars value={rating} interactive onChange={setRating} />
          </label>
          <label>
            Headline <small>(optional)</small>
            <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} maxLength={120} />
          </label>
          <label>
            Your experience
            <textarea
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value)}
              placeholder="Share fabric quality, drape, color accuracy, and wholesale fulfillment experience."
              minLength={MIN_REVIEW_COMMENT_LENGTH}
              maxLength={MAX_REVIEW_COMMENT_LENGTH}
              rows={5}
              required
            />
            <span className="review-char-count">
              {comment.length}/{MAX_REVIEW_COMMENT_LENGTH}
            </span>
          </label>
          <ReviewImageUploader files={files} onChange={setFiles} disabled={submitting} />
          <div className="review-modal-actions">
            <Button type="button" variant="secondary" onClick={resetAndClose}>
              Cancel
            </Button>
            <LoadingButton type="submit" loading={submitting}>
              {existing ? "Update review" : "Submit review"}
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}
