import { BadgeCheck } from "lucide-react";
import ReviewStatusBadge from "@/components/reviews/review-status-badge";
import RatingStars from "@/components/reviews/rating-stars";
import ReviewBody from "@/components/reviews/review-body";
import ReviewPhotoGallery from "@/components/reviews/review-photo-gallery";
import ReviewHelpfulButton from "@/components/reviews/review-helpful-button";
import type { PublicReview } from "@/features/reviews/types";

/**
 * In the store's time zone (every store sells in India), so the server render
 * and the browser show the same date and hydration matches.
 */
const reviewDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

type ReviewCardProps = {
  review: PublicReview;
  showModeration?: boolean;
  /** The signed-in shopper wrote it (My reviews): no "Helpful" voting, and "your" photos. */
  ownReview?: boolean;
};

export default function ReviewCard({ review, showModeration = false, ownReview = false }: ReviewCardProps) {
  const author = review.authorName ?? "Verified buyer";
  const published = review.moderationStatus === undefined || review.moderationStatus === "approved";
  return (
    <article className="review-card">
      <header className="review-card-head">
        <span className="review-card-avatar" aria-hidden="true">
          {author.charAt(0).toUpperCase()}
        </span>
        <div className="review-card-author">
          <strong>{author}</strong>
          {review.verifiedPurchase ? (
            <span className="review-verified-badge">
              <BadgeCheck size={14} aria-hidden="true" /> Verified purchase
            </span>
          ) : null}
          {showModeration && review.moderationStatus ? <ReviewStatusBadge status={review.moderationStatus} /> : null}
        </div>
        {review.createdAt ? <time dateTime={review.createdAt}>{reviewDate.format(new Date(review.createdAt))}</time> : null}
      </header>
      <div className="review-card-rating">
        <RatingStars value={review.rating} size="sm" />
        {review.title ? <h3 className="review-card-title">{review.title}</h3> : null}
      </div>
      <ReviewBody text={review.comment} />
      {review.moderationStatus === "rejected" && review.moderationNote ? (
        <p className="review-card-note">{review.moderationNote}</p>
      ) : null}
      {review.images?.length ? (
        <ReviewPhotoGallery images={review.images} owner={ownReview ? "your" : `${author}'s`} />
      ) : null}
      {!ownReview && !showModeration && published ? (
        <ReviewHelpfulButton reviewId={review._id} initialCount={review.helpfulCount ?? 0} />
      ) : null}
    </article>
  );
}
