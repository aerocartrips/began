"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { formatNumber } from "@/lib/format";

const SHEET_QUERY = "(max-width: 900px)";
const FOCUSABLE = "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled)";

type CatalogFiltersPanelProps = {
  total: number;
  activeCount: number;
  clearHref: string;
  children: ReactNode;
};

/**
 * The filter form sits beside the results on wide screens. On phones and
 * tablets it opens as a bottom sheet from a "Filter & sort" button (repeated
 * as a floating button once the toolbar scrolls away). Changes still apply
 * immediately, so the sheet's button always shows the live result count.
 */
export default function CatalogFiltersPanel({ total, activeCount, clearHref, children }: CatalogFiltersPanelProps) {
  const [open, setOpen] = useState(false);
  const [floating, setFloating] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const products = `${formatNumber(total)} ${total === 1 ? "product" : "products"}`;

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setFloating(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(".catalog-filters-panel__close")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      // Keep Tab inside the sheet while it is open.
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    const sheet = window.matchMedia(SHEET_QUERY);
    const onResize = () => {
      if (!sheet.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    sheet.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      sheet.removeEventListener("change", onResize);
      openerRef.current?.focus();
    };
  }, [open]);

  function show(event: { currentTarget: HTMLButtonElement }) {
    openerRef.current = event.currentTarget;
    setOpen(true);
  }

  const badge = activeCount ? <span className="catalog-toolbar__badge">{activeCount}</span> : null;
  const buttonLabel = activeCount ? `Filter and sort, ${activeCount} applied` : "Filter and sort";

  return (
    <>
      <div ref={toolbarRef} className="catalog-toolbar">
        <p className="catalog-toolbar__count">{products}</p>
        <button
          type="button"
          className="catalog-toolbar__button"
          aria-controls={panelId}
          aria-expanded={open}
          aria-label={buttonLabel}
          onClick={show}
        >
          <SlidersHorizontal size={16} aria-hidden="true" /> Filter &amp; sort {badge}
        </button>
      </div>
      <button
        type="button"
        className="catalog-filter-fab"
        data-visible={(floating && !open) || undefined}
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={buttonLabel}
        onClick={show}
      >
        <SlidersHorizontal size={16} aria-hidden="true" /> Filter &amp; sort {badge}
      </button>

      <div className="catalog-filters-backdrop" data-open={open || undefined} aria-hidden="true" onClick={() => setOpen(false)} />
      <div
        ref={panelRef}
        id={panelId}
        className="catalog-filters-panel"
        data-open={open || undefined}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-labelledby={open ? titleId : undefined}
      >
        <div className="catalog-filters-panel__head">
          <h2 id={titleId}>Filter &amp; sort</h2>
          <button type="button" className="catalog-filters-panel__close" aria-label="Close filters" onClick={() => setOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="catalog-filters-panel__body">{children}</div>
        <div className="catalog-filters-panel__foot">
          {activeCount ? (
            <Link className="button button-glass" href={clearHref} scroll={false}>
              Clear all
            </Link>
          ) : null}
          <button type="button" className="button button-primary" onClick={() => setOpen(false)}>
            Show {products}
          </button>
        </div>
      </div>
    </>
  );
}
