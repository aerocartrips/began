"use client";

import Lightbox, { type SlideImage } from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

type ProductLightboxProps = {
  slides: SlideImage[];
  index: number;
  title: string;
  onClose: () => void;
  onView: (index: number) => void;
};

const HIDDEN = () => null;

/**
 * Full-screen product photo viewer (loaded on first open). Zoom: pinch,
 * double-tap/double-click, mouse wheel or trackpad, +/- keys, and the toolbar
 * buttons, with drag to pan. Swipe, arrow keys or thumbnails change photos;
 * Escape, the close button or pulling down closes it.
 */
export default function ProductLightbox({ slides, index, title, onClose, onView }: ProductLightboxProps) {
  const single = slides.length < 2;
  // Client-only component (loaded with ssr: false), so matchMedia is available.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={slides}
      plugins={single ? [Zoom] : [Thumbnails, Zoom, Counter]}
      className="product-lightbox"
      on={{ view: ({ index: current }) => onView(current) }}
      carousel={{ finite: single, preload: 1, padding: "16px", spacing: "8%", imageFit: "contain" }}
      controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
      zoom={{
        // Up to the photo's full resolution (×1.5 on low-density screens), in two double-tap steps.
        maxZoomPixelRatio: 1.5,
        zoomInMultiplier: 2,
        doubleClickMaxStops: 2,
        scrollToZoom: true,
      }}
      thumbnails={{ width: 56, height: 70, border: 2, borderRadius: 8, padding: 0, gap: 10, imageFit: "cover", vignette: false, showToggle: false }}
      animation={reduceMotion ? { fade: 0, swipe: 0, zoom: 0 } : { fade: 200, swipe: 260, zoom: 240 }}
      render={single ? { buttonPrev: HIDDEN, buttonNext: HIDDEN } : undefined}
      labels={{ Lightbox: `${title} photos`, Close: "Close photos", Previous: "Previous photo", Next: "Next photo" }}
    />
  );
}
