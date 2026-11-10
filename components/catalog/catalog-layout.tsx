"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import CountBadge from "@/components/ui/count-badge";
import VisibleStyle from "@/components/ui/visible-style";
import { formatNumber } from "@/lib/format";

/** Below this width the filters open as a bottom sheet (app/catalog.css). */
const SHEET_QUERY = "(max-width: 900px)";
/** The page behind an open sheet doesn't scroll; switched off at once if the page is hidden. */
const LOCK_PAGE_SCROLL = "html { overflow: hidden; }";
const FOCUSABLE = "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), summary";

type CatalogLayoutProps = {
  total: number;
  /** First and last result on this page (1-based). */
  range: { first: number; last: number };
  activeCount: number;
  clearHref: string;
  /** The filter form (components/catalog/catalog-filters.tsx). */
  filters: ReactNode;
  /** The sort control (components/catalog/catalog-sort-select.tsx). */
  sort: ReactNode;
  /** Applied filters, the grid and pagination. */
  children: ReactNode;
};

/**
 * The catalogue's frame: filters in a sidebar beside the results on wide
 * screens, and a bottom sheet behind a "Filters" button on phones and
 * tablets (repeated as a floating button once the toolbar scrolls away).
 * The toolbar above the results holds the count and the sort everywhere.
 * Filters apply as they change, so the sheet's button shows the live count.
 */
export default function CatalogLayout({ total, range, activeCount, clearHref, filters, sort, children }: CatalogLayoutProps) {
  const [open, setOpen] = useState(false);
  const [floating, setFloating] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const products = `${formatNumber(total)} ${total === 1 ? "product" : "products"}`;

  // Next keeps this page mounted, hidden, after a link inside the sheet is followed: close the
  // sheet then, so coming back shows the results (preserving-ui-state guide, transient UI).
  useLayoutEffect(() => () => setOpen(false), []);

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
    panel?.querySelector<HTMLElement>(".catalog-sidebar__close")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      // Keep Tab inside the sheet while it is open.
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.offsetParent !== null);
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

  const filterButtonLabel = activeCount ? `Filters, ${activeCount} applied` : "Filters";
  const filterButton = (className: string, extra?: { "data-visible"?: true }) => (
    <button type="button" className={className} aria-controls={panelId} aria-expanded={open} aria-label={filterButtonLabel} onClick={show} {...extra}>
      <SlidersHorizontal size={16} aria-hidden="true" /> Filters <CountBadge count={activeCount} />
    </button>
  );

  return (
    <div className="catalog-layout">
      {open ? <VisibleStyle css={LOCK_PAGE_SCROLL} media={SHEET_QUERY} /> : null}
      <div className="catalog-filters-backdrop" data-open={open || undefined} aria-hidden="true" onClick={() => setOpen(false)} />

      <aside
        ref={panelRef}
        id={panelId}
        className="catalog-sidebar"
        data-open={open || undefined}
        aria-labelledby={titleId}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
      >
        <div className="catalog-sidebar__head">
          <h2 id={titleId}>Filters</h2>
          {activeCount ? (
            <Link className="catalog-sidebar__clear" href={clearHref} scroll={false}>
              Clear all
            </Link>
          ) : null}
          <button type="button" className="catalog-sidebar__close" aria-label="Close filters" onClick={() => setOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="catalog-sidebar__body">{filters}</div>
        <div className="catalog-sidebar__foot">
          {activeCount ? (
            <Link className="button button-glass" href={clearHref} scroll={false}>
              Clear all
            </Link>
          ) : null}
          <button type="button" className="button button-primary" onClick={() => setOpen(false)}>
            Show {products}
          </button>
        </div>
      </aside>

      <section className="catalog-results" aria-label="Products">
        <div ref={toolbarRef} className="catalog-toolbar">
          <p className="catalog-toolbar__count" role="status">
            {total === 0 ? (
              "No products found"
            ) : (
              <>
                <span className="catalog-toolbar__range">
                  Showing {formatNumber(range.first)}–{formatNumber(range.last)} of{" "}
                </span>
                {products}
              </>
            )}
          </p>
          <div className="catalog-toolbar__sort">{sort}</div>
          {filterButton("catalog-toolbar__filter")}
        </div>
        {children}
      </section>

      {filterButton("catalog-filter-fab", floating && !open ? { "data-visible": true } : undefined)}
    </div>
  );
}
