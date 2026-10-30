"use client";

import Image from "next/image";
import { useState } from "react";
import type { ReviewImage } from "@/features/reviews/types";

type ReviewPhotoGalleryProps = {
  images: ReviewImage[];
};

export default function ReviewPhotoGallery({ images }: ReviewPhotoGalleryProps) {
  const [active, setActive] = useState<ReviewImage | null>(null);

  return (
    <>
      <div className="review-photo-grid">
        {images.map((image) => (
          <button
            key={image._id}
            type="button"
            className="review-photo-thumb"
            onClick={() => setActive(image)}
          >
            <Image
              src={image.thumbnailUrl || image.url}
              alt={image.alt || "Review photo"}
              fill
              sizes="96px"
              className="cover-image"
            />
          </button>
        ))}
      </div>
      {active ? (
        <div className="review-lightbox" role="dialog" aria-modal="true" aria-label="Review photo">
          <button type="button" className="review-lightbox-close" onClick={() => setActive(null)}>
            Close
          </button>
          <Image
            src={active.url}
            alt={active.alt || "Review photo enlarged"}
            width={active.width ?? 900}
            height={active.height ?? 1200}
            className="review-lightbox-image"
          />
        </div>
      ) : null}
    </>
  );
}
