"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { SlideImage } from "yet-another-react-lightbox";
import ProductImage from "@/components/images/product-image";
import { buildClientDeliveryUrl } from "@/lib/cloudinary/transformations";
import type { ReviewImage } from "@/features/reviews/types";

// The same full-screen viewer as the product photos, loaded on first open.
const ProductLightbox = dynamic(() => import("@/components/catalog/product-lightbox"), { ssr: false });

/**
 * A review's customer photos: thumbnails that open the zoomable viewer.
 * `owner` reads before "review": "Priya's", or "your" on the author's own page.
 */
export default function ReviewPhotoGallery({ images, owner }: { images: ReviewImage[]; owner: string }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const slides = useMemo<SlideImage[]>(
    () =>
      images.map((image) => ({
        src: (image.publicId ? buildClientDeliveryUrl(image.publicId, "highResolution") : null) ?? image.url,
        alt: image.alt || `Photo from ${owner} review`,
        thumbnail: image.thumbnailUrl || image.url,
      })),
    [owner, images],
  );

  return (
    <>
      <ul className="review-photo-grid" aria-label={`Photos from ${owner} review`}>
        {images.map((image, index) => (
          <li key={image._id}>
            <button
              type="button"
              className="review-photo-thumb"
              aria-label={`Open photo ${index + 1} of ${images.length}`}
              onClick={() => setViewerIndex(index)}
            >
              <ProductImage image={{ publicId: image.publicId, url: image.url, alt: slides[index].alt }} preset="thumbnail" sizes="80px" />
            </button>
          </li>
        ))}
      </ul>
      {viewerIndex !== null ? (
        <ProductLightbox
          slides={slides}
          index={viewerIndex}
          title={`Photos from ${owner} review`}
          onClose={() => setViewerIndex(null)}
          onView={() => undefined}
        />
      ) : null}
    </>
  );
}
