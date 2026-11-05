"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type UIEvent } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import ProductImage from "@/components/images/product-image";
import type { CatalogImage } from "@/features/catalog/types";

/** Index of the slide in view in a horizontal scroll-snap track. */
function currentSlide(track: HTMLElement) {
  return track.clientWidth ? Math.round(track.scrollLeft / track.clientWidth) : 0;
}

function scrollToSlide(track: HTMLElement | null, index: number, smooth = true) {
  const slide = track?.children[index] as HTMLElement | undefined;
  if (track && slide) track.scrollTo({ left: slide.offsetLeft, behavior: smooth ? "smooth" : "auto" });
}

/**
 * Product photos. Phones swipe between them (scroll snap, with dots and a
 * counter); wider screens add thumbnails and mouse-only hover zoom. Tapping a
 * photo opens a full-screen viewer that also swipes (keyboard: ←/→, Esc).
 * The parent keys this component by photo set, so a colour change starts over.
 */
export default function ProductGallery({ images, productName }: { images: CatalogImage[]; productName: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ index: number; origin: string } | null>(null);
  const [viewer, setViewer] = useState<{ start: number; index: number } | null>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const viewerTrackRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const count = images.length;
  const viewerStart = viewer?.start ?? null;

  // The viewer's slides mount when it opens; jump to the tapped photo before paint.
  useLayoutEffect(() => {
    if (viewerStart !== null) scrollToSlide(viewerTrackRef.current, viewerStart, false);
  }, [viewerStart]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || count < 2) return;
    const onKey = (event: KeyboardEvent) => {
      const track = viewerTrackRef.current;
      if (!track || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) return;
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      scrollToSlide(track, (currentSlide(track) + step + count) % count);
    };
    dialog.addEventListener("keydown", onKey);
    return () => dialog.removeEventListener("keydown", onKey);
  }, [count]);

  if (count === 0) {
    return <div className="product-gallery product-gallery--empty" aria-label={`${productName} has no photos yet`} />;
  }

  function trackZoom(event: PointerEvent<HTMLButtonElement>, index: number) {
    // Hover zoom is for mice only: on touch screens a tap would leave the photo stuck zoomed in.
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setZoom({ index, origin: `${x}% ${y}%` });
  }

  function openViewer(index: number) {
    setZoom(null);
    setViewer({ start: index, index });
    dialogRef.current?.showModal();
  }

  function stepViewer(step: number) {
    const track = viewerTrackRef.current;
    if (track) scrollToSlide(track, (currentSlide(track) + step + count) % count);
  }

  return (
    <div className="product-gallery">
      <div className="product-gallery__viewport">
        <ul
          ref={trackRef}
          className="product-gallery__track"
          aria-label="Product photos"
          onScroll={(event: UIEvent<HTMLUListElement>) => setActive(currentSlide(event.currentTarget))}
        >
          {images.map((image, index) => {
            const zoomed = zoom?.index === index;
            return (
              <li key={`${image.url}-${index}`} className="product-gallery__slide">
                <button
                  type="button"
                  className={`product-gallery__stage${zoomed ? " is-zoomed" : ""}`}
                  style={zoomed ? { ["--zoom-origin" as string]: zoom.origin } : undefined}
                  tabIndex={index === active ? 0 : -1}
                  onPointerMove={(event) => trackZoom(event, index)}
                  onPointerLeave={() => setZoom(null)}
                  onClick={() => openViewer(index)}
                  aria-label={`View photo ${index + 1} of ${count} full screen`}
                >
                  <ProductImage
                    image={image}
                    preset="highResolution"
                    priority={index === 0}
                    sizes="(max-width: 900px) 100vw, 55vw"
                  />
                </button>
              </li>
            );
          })}
        </ul>
        <span className="product-gallery__expand" aria-hidden="true"><Expand size={16} /></span>
        {count > 1 ? (
          <>
            <span className="product-gallery__counter" aria-hidden="true">{active + 1} / {count}</span>
            <span className="product-gallery__dots" aria-hidden="true">
              {images.map((image, index) => (
                <span key={`${image.url}-${index}`} data-active={index === active || undefined} />
              ))}
            </span>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <ul className="product-gallery__thumbs" aria-label="Choose a photo">
          {images.map((image, index) => (
            <li key={`${image.url}-${index}`}>
              <button
                type="button"
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === active}
                onClick={() => scrollToSlide(trackRef.current, index)}
              >
                <ProductImage image={image} preset="thumbnail" sizes="88px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <dialog
        ref={dialogRef}
        className="product-lightbox"
        aria-label={`${productName} photos`}
        onClose={() => {
          // Leave the page gallery on the photo the shopper ended on.
          if (viewer) scrollToSlide(trackRef.current, viewer.index, false);
          setViewer(null);
        }}
      >
        {viewer ? (
          <ul
            ref={viewerTrackRef}
            className="product-lightbox__track"
            onScroll={(event: UIEvent<HTMLUListElement>) => {
              const index = currentSlide(event.currentTarget);
              setViewer((current) => (current && current.index !== index ? { ...current, index } : current));
            }}
          >
            {images.map((image, index) => (
              <li key={`${image.url}-${index}`} className="product-lightbox__slide">
                <ProductImage image={image} preset="highResolution" sizes="100vw" className="product-lightbox__image" />
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" className="product-lightbox__close" onClick={() => dialogRef.current?.close()} aria-label="Close">
          <X size={22} />
        </button>
        {count > 1 ? (
          <>
            <button type="button" className="product-lightbox__nav is-prev" aria-label="Previous photo" onClick={() => stepViewer(-1)}>
              <ChevronLeft size={24} />
            </button>
            <button type="button" className="product-lightbox__nav is-next" aria-label="Next photo" onClick={() => stepViewer(1)}>
              <ChevronRight size={24} />
            </button>
            <p className="product-lightbox__counter" aria-live="polite">
              {(viewer?.index ?? 0) + 1} / {count}
            </p>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
