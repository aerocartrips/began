import ReviewStatusBadge from "@/components/reviews/ReviewStatusBadge";
import RatingStars from "@/components/reviews/RatingStars";
import ReviewPhotoGallery from "@/components/reviews/ReviewPhotoGallery";
import ReviewHelpfulButton from "@/components/reviews/ReviewHelpfulButton";
import type { PublicReview } from "@/features/reviews/types";

type ReviewCardProps = {
  review: PublicReview;
  showModeration?: boolean;
};

export default function ReviewCard({ review, showModeration = false }: ReviewCardProps) {
  return (
    <article className="review-card">
      <header className="review-card-head">
        <div>
          <strong>{review.authorName ?? "Verified buyer"}</strong>
          {review.verifiedPurchase ? <span className="review-verified-badge">Verified purchase</span> : null}
          {showModeration && review.moderationStatus ? (
            <ReviewStatusBadge status={review.moderationStatus} />
          ) : null}
        </div>
        <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString()}</time>
      </header>
      <RatingStars value={review.rating} size="sm" />
      {review.title ? <h3 className="review-card-title">{review.title}</h3> : null}
      <p className="review-card-body">{review.comment}</p>
      {review.moderationStatus === "rejected" && review.moderationNote ? (
        <p className="review-card-note">{review.moderationNote}</p>
      ) : null}
      {review.images?.length ? <ReviewPhotoGallery images={review.images} /> : null}
      <ReviewHelpfulButton
        reviewId={review._id}
        initialCount={review.helpfulCount ?? 0}
        showVoting={
          !showModeration &&
          (review.moderationStatus === "approved" || review.moderationStatus === undefined)
        }
      />
    </article>
  );
}
