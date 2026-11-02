"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import ProductImage from "@/components/images/product-image";
import type { CatalogImage } from "@/features/catalog/types";

/**
 * Product photos with hover zoom, thumbnails and a full-screen viewer
 * (keyboard: ←/→ to browse, Esc to close).
 */
export default function ProductGallery({ images, productName }: { images: CatalogImage[]; productName: string }) {
  const [active, setActive] = useState(0);
  const [zoomOrigin, setZoomOrigin] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const count = images.length;
  const index = Math.min(active, Math.max(0, count - 1));
  const current = images[index];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setActive((value) => (value + 1) % count);
      if (event.key === "ArrowLeft") setActive((value) => (value - 1 + count) % count);
    };
    dialog.addEventListener("keydown", onKey);
    return () => dialog.removeEventListener("keydown", onKey);
  }, [count]);

  if (!current) {
    return <div className="product-gallery product-gallery--empty" aria-label={`${productName} has no photos yet`} />;
  }

  function trackZoom(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${x}% ${y}%`);
  }

  return (
    <div className="product-gallery">
      <button
        type="button"
        className={`product-gallery__stage${zoomOrigin ? " is-zoomed" : ""}`}
        style={zoomOrigin ? { ["--zoom-origin" as string]: zoomOrigin } : undefined}
        onMouseMove={trackZoom}
        onMouseLeave={() => setZoomOrigin(null)}
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`View ${current.alt} full screen`}
      >
        <ProductImage image={current} preset="highResolution" priority sizes="(max-width: 900px) 100vw, 55vw" />
        <span className="product-gallery__expand" aria-hidden="true"><Expand size={16} /></span>
      </button>

      {count > 1 ? (
        <ul className="product-gallery__thumbs" aria-label="Product photos">
          {images.map((image, thumbIndex) => (
            <li key={`${image.url}-${thumbIndex}`}>
              <button
                type="button"
                aria-label={`Show photo ${thumbIndex + 1}`}
                aria-current={thumbIndex === index}
                onClick={() => setActive(thumbIndex)}
              >
                <ProductImage image={image} preset="thumbnail" sizes="88px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <dialog ref={dialogRef} className="product-lightbox" aria-label={`${productName} photos`}>
        <button type="button" className="product-lightbox__close" onClick={() => dialogRef.current?.close()} aria-label="Close">
          <X size={20} />
        </button>
        {count > 1 ? (
          <button type="button" className="product-lightbox__nav is-prev" aria-label="Previous photo" onClick={() => setActive((index - 1 + count) % count)}>
            <ChevronLeft size={24} />
          </button>
        ) : null}
        <figure>
          <ProductImage image={current} preset="highResolution" sizes="100vw" fill={false} width={1600} height={2000} className="product-lightbox__image" />
          <figcaption>{index + 1} / {count}</figcaption>
        </figure>
        {count > 1 ? (
          <button type="button" className="product-lightbox__nav is-next" aria-label="Next photo" onClick={() => setActive((index + 1) % count)}>
            <ChevronRight size={24} />
          </button>
        ) : null}
      </dialog>
    </div>
  );
}
