"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type UIEvent } from "react";
import { Expand } from "lucide-react";
import type { SlideImage } from "yet-another-react-lightbox";
import ProductImage from "@/components/images/product-image";
import { buildClientDeliveryUrl, cloudinaryImageLoader } from "@/lib/cloudinary/transformations";
import type { CatalogImage } from "@/features/catalog/types";

// The full-screen viewer and its styles load on first use; hovering or touching the gallery prefetches them.
const loadLightbox = () => import("@/components/catalog/product-lightbox");
const ProductLightbox = dynamic(loadLightbox, { ssr: false });

/** Magnification of the desktop hover zoom (keep in step with --zoom-scale in app/catalog.css). */
const HOVER_ZOOM = 2.4;
/**
 * Rendered width of the main photo. Phones: nearly the screen width (the next
 * photo peeks in). Tablets: half the page. Desktops: the photo is sized to fit
 * the screen height (--pdp-stage-w in app/catalog.css), at most 688px wide.
 */
const STAGE_SIZES = "(max-width: 760px) 90vw, (max-width: 1023px) 48vw, 688px";
/** Rendered width of the zoomed photo: the stage width times the zoom. */
const ZOOM_SIZES = `(max-width: 760px) ${Math.round(90 * HOVER_ZOOM)}vw, (max-width: 1023px) ${Math.round(48 * HOVER_ZOOM)}vw, ${Math.round(688 * HOVER_ZOOM)}px`;

function sourceOf(image: CatalogImage, preset: "thumbnail" | "highResolution") {
  return (image.publicId ? buildClientDeliveryUrl(image.publicId, preset) : null) ?? image.url;
}

/**
 * Distance between slide starts: one full slide where photos fill the track,
 * a slide plus the gap on phones (where the next photo peeks in).
 */
function slidePitch(track: HTMLElement) {
  const first = track.children[0] as HTMLElement | undefined;
  const second = track.children[1] as HTMLElement | undefined;
  return first && second ? second.offsetLeft - first.offsetLeft : track.clientWidth;
}

/** Index of the slide in view in a horizontal scroll-snap track. */
function currentSlide(track: HTMLElement) {
  const pitch = slidePitch(track);
  return pitch > 0 ? Math.min(track.children.length - 1, Math.round(track.scrollLeft / pitch)) : 0;
}

function scrollToSlide(track: HTMLElement | null, index: number, smooth = true) {
  const first = track?.children[0] as HTMLElement | undefined;
  const slide = track?.children[index] as HTMLElement | undefined;
  if (track && first && slide) track.scrollTo({ left: slide.offsetLeft - first.offsetLeft, behavior: smooth ? "smooth" : "auto" });
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/**
 * Product photos. Phones swipe between them (scroll snap, dots, counter);
 * wider screens add thumbnails (a vertical rail beside the photo on desktops)
 * and a mouse hover zoom that follows the cursor, sharpened by a
 * high-resolution copy loaded on first hover. Clicking or tapping a photo
 * opens the full-screen viewer (pinch, double-tap, wheel and keyboard zoom
 * with panning). The parent keys this component by photo set, so a colour
 * change starts over.
 */
export default function ProductGallery({ images, productName }: { images: CatalogImage[]; productName: string }) {
  const [active, setActive] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  /** Slides whose high-resolution zoom layer has been requested (on first hover). */
  const [zoomLayers, setZoomLayers] = useState<ReadonlySet<number>>(() => new Set());
  const trackRef = useRef<HTMLUListElement>(null);
  const thumbsRef = useRef<HTMLUListElement>(null);
  const frameRef = useRef(0);
  const lastViewedRef = useRef(0);
  const count = images.length;

  // Keep the current thumbnail in view when the rail scrolls (many photos): the rail only, never the page.
  useEffect(() => {
    const rail = thumbsRef.current;
    const thumb = rail?.children[active] as HTMLElement | undefined;
    if (!rail || !thumb || (rail.scrollHeight <= rail.clientHeight && rail.scrollWidth <= rail.clientWidth)) return;
    rail.scrollTo({
      top: thumb.offsetTop - (rail.clientHeight - thumb.offsetHeight) / 2,
      left: thumb.offsetLeft - (rail.clientWidth - thumb.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [active]);

  const slides = useMemo<SlideImage[]>(
    () =>
      images.map((image) => ({
        src: sourceOf(image, "highResolution"),
        alt: image.alt || productName,
        thumbnail: sourceOf(image, "thumbnail"),
      })),
    [images, productName],
  );

  if (count === 0) {
    return <div className="product-gallery product-gallery--empty" aria-label={`${productName} has no photos yet`} />;
  }

  function startZoom(event: PointerEvent<HTMLButtonElement>, index: number) {
    // Hover zoom is for mice: on touch screens a tap opens the viewer instead.
    if (event.pointerType !== "mouse") return;
    void loadLightbox();
    event.currentTarget.dataset.zooming = "";
    moveZoom(event);
    if (!zoomLayers.has(index)) setZoomLayers((current) => new Set(current).add(index));
  }

  /** Writes the cursor position to CSS variables once per frame: no React render per mouse move. */
  function moveZoom(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse") return;
    const stage = event.currentTarget;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const rect = stage.getBoundingClientRect();
      stage.style.setProperty("--zoom-x", `${clampPercent(((clientX - rect.left) / rect.width) * 100)}%`);
      stage.style.setProperty("--zoom-y", `${clampPercent(((clientY - rect.top) / rect.height) * 100)}%`);
    });
  }

  function endZoom(event: PointerEvent<HTMLButtonElement>) {
    cancelAnimationFrame(frameRef.current);
    delete event.currentTarget.dataset.zooming;
  }

  function openViewer(index: number, stage: HTMLElement) {
    delete stage.dataset.zooming;
    lastViewedRef.current = index;
    setViewerIndex(index);
  }

  function closeViewer() {
    setViewerIndex(null);
    // Leave the page gallery on the photo the shopper ended on.
    scrollToSlide(trackRef.current, lastViewedRef.current, false);
  }

  return (
    <div
      className={count > 1 ? "product-gallery product-gallery--multi" : "product-gallery"}
      onPointerEnter={() => void loadLightbox()}
      onTouchStart={() => void loadLightbox()}
    >
      <div className="product-gallery__viewport">
        <ul
          ref={trackRef}
          className="product-gallery__track"
          aria-label="Product photos"
          onScroll={(event: UIEvent<HTMLUListElement>) => setActive(currentSlide(event.currentTarget))}
        >
          {images.map((image, index) => (
            <li key={`${image.url}-${index}`} className="product-gallery__slide">
              <button
                type="button"
                className="product-gallery__stage"
                tabIndex={index === active ? 0 : -1}
                onPointerEnter={(event) => startZoom(event, index)}
                onPointerMove={moveZoom}
                onPointerLeave={endZoom}
                onClick={(event) => openViewer(index, event.currentTarget)}
                aria-label={`Photo ${index + 1} of ${count}: open full screen and zoom`}
              >
                <ProductImage image={image} preset="highResolution" priority={index === 0} sizes={STAGE_SIZES} />
                {zoomLayers.has(index) ? (
                  <Image
                    className="product-gallery__zoom"
                    src={image.publicId && process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? image.publicId : image.url}
                    loader={image.publicId && process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? cloudinaryImageLoader : undefined}
                    alt=""
                    aria-hidden="true"
                    fill
                    loading="eager"
                    sizes={ZOOM_SIZES}
                    onLoad={(event) => {
                      event.currentTarget.dataset.loaded = "";
                    }}
                  />
                ) : null}
              </button>
            </li>
          ))}
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
        <ul ref={thumbsRef} className="product-gallery__thumbs" aria-label="Choose a photo">
          {images.map((image, index) => (
            <li key={`${image.url}-${index}`}>
              <button
                type="button"
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === active}
                onClick={() => scrollToSlide(trackRef.current, index)}
              >
                <ProductImage image={image} preset="thumbnail" sizes="72px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {viewerIndex !== null ? (
        <ProductLightbox
          slides={slides}
          index={viewerIndex}
          title={productName}
          onClose={closeViewer}
          onView={(index) => {
            lastViewedRef.current = index;
          }}
        />
      ) : null}
    </div>
  );
}
