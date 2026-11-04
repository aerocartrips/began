"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

const INTERVAL_MS = 6500;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(reducedMotionQuery);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(reducedMotionQuery).matches,
    () => true,
  );
}

/**
 * Drives the server-rendered slides: native scroll-snap (swipe works for free),
 * autoplay that pauses on hover, focus, hidden tabs and reduced motion, plus
 * arrows, dots with progress and ←/→ keys.
 */
export default function HeroBannerController({ count, children }: { count: number; children: ReactNode }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useReducedMotion();
  const multiple = count > 1;
  const autoplay = multiple && playing && !hovered && !focused && visible && !reducedMotion;

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      const slide = track?.children[(index + count) % count] as HTMLElement | undefined;
      if (track && slide) track.scrollTo({ left: slide.offsetLeft, behavior: reducedMotion ? "auto" : "smooth" });
    },
    [count, reducedMotion],
  );

  // The slide most in view is the active one; it gets data-active for its entrance animation.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !multiple) return;
    const slides = Array.from(track.children) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = slides.indexOf(entry.target as HTMLElement);
            slides.forEach((slide, slideIndex) => {
              if (slideIndex === index) slide.dataset.active = "true";
              else delete slide.dataset.active;
            });
            setActive(index);
          }
        }
      },
      { root: track, threshold: 0.6 },
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [multiple]);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => goTo(active + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [active, autoplay, goTo]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(active + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(active - 1);
    }
  }

  return (
    <div
      className="hero-banner__viewport"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={multiple ? onKeyDown : undefined}
    >
      <ul ref={trackRef} className="hero-banner__track" aria-live={autoplay ? "off" : "polite"}>
        {children}
      </ul>

      {multiple ? (
        <div className="hero-banner__controls">
          <button type="button" className="hero-banner__arrow" aria-label="Previous slide" onClick={() => goTo(active - 1)}>
            <ChevronLeft size={20} />
          </button>
          <div className="hero-banner__dots" role="group" aria-label="Choose slide">
            {Array.from({ length: count }, (_, index) => (
              <button
                key={index}
                type="button"
                className="hero-banner__dot"
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === active ? "true" : undefined}
                onClick={() => goTo(index)}
              >
                {/* Re-keyed so the progress bar restarts on every slide change. */}
                {index === active ? (
                  <span key={`${active}-${autoplay}`} className="hero-banner__progress" data-running={autoplay} style={{ animationDuration: `${INTERVAL_MS}ms` }} />
                ) : null}
              </button>
            ))}
          </div>
          <button type="button" className="hero-banner__arrow" aria-label="Next slide" onClick={() => goTo(active + 1)}>
            <ChevronRight size={20} />
          </button>
          <button
            type="button"
            className="hero-banner__arrow"
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            aria-pressed={!playing}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      ) : null}
    </div>
  );
}
