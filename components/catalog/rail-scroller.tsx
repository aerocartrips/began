"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The scrolling part of a product rail. Touch screens swipe it natively
 * (scroll snap, no script). Mouse users also get previous / next buttons that
 * move one screenful. Which of them apply is written to the wrapper as
 * `data-can-prev` / `data-can-next` straight from the scroll position, and CSS
 * shows the buttons (fine pointers only), so scrolling never re-renders the
 * row. The items stay server-rendered: they arrive as `children`.
 */
export default function RailScroller({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const railRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const frame = useRef(0);

  const measure = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const rail = railRef.current;
      const list = listRef.current;
      if (!rail || !list) return;
      const max = list.scrollWidth - list.clientWidth;
      rail.toggleAttribute("data-can-prev", list.scrollLeft > 1);
      rail.toggleAttribute("data-can-next", list.scrollLeft < max - 1);
    });
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    measure();
    list.addEventListener("scroll", measure, { passive: true });
    // Size changes: viewport, a hidden tab panel becoming visible, fonts loading.
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resize?.observe(list);
    return () => {
      list.removeEventListener("scroll", measure);
      resize?.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [measure]);

  // The items can change without a resize (personal picks replacing popular ones).
  useEffect(() => measure(), [children, measure]);

  function page(direction: 1 | -1) {
    const list = listRef.current;
    const item = list?.firstElementChild;
    if (!list || !(item instanceof HTMLElement)) return;
    const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0;
    const step = item.offsetWidth + gap;
    const perPage = Math.max(1, Math.floor((list.clientWidth + gap) / step));
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollBy({ left: direction * perPage * step, behavior: smooth ? "smooth" : "auto" });
  }

  return (
    <div ref={railRef} className="rail">
      <ul ref={listRef} id={id} className="product-rail" aria-label={label}>
        {children}
      </ul>
      <button type="button" className="rail__arrow rail__arrow--prev" aria-controls={id} aria-label={`Scroll ${label} back`} onClick={() => page(-1)}>
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button type="button" className="rail__arrow rail__arrow--next" aria-controls={id} aria-label={`Scroll ${label} forward`} onClick={() => page(1)}>
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
