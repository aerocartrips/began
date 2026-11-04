import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import type { HomeReview } from "@/features/catalog/types";

const MAX_COMMENT = 220;

/** Approved reviews from verified buyers; first names only. */
export default function HomeReviews({ reviews }: { reviews: HomeReview[] }) {
  return (
    <ul className="home-reviews">
      {reviews.map((review) => (
        <li key={review.id}>
          <figure className="home-review">
            <p className="home-review__stars" role="img" aria-label={`Rated ${review.rating} out of 5`}>
              {"★".repeat(review.rating)}
              <span>{"★".repeat(5 - review.rating)}</span>
            </p>
            <blockquote>
              {review.title ? <strong>{review.title}</strong> : null}
              <p>{review.comment.length > MAX_COMMENT ? `${review.comment.slice(0, MAX_COMMENT).trimEnd()}…` : review.comment}</p>
            </blockquote>
            <figcaption>
              <span className="home-review__author">
                {review.authorName}
                <span className="home-review__verified">
                  <BadgeCheck size={13} aria-hidden="true" /> Verified buyer
                </span>
              </span>
              <Link href={`/products/${review.product.slug}`}>{review.product.name}</Link>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
