"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Button from "@/components/ui/button";
import ProductCard from "@/components/catalog/product-card";
import CatalogCardSkeleton from "@/components/ui/loaders/catalog-card-skeleton";
import { visibilityClass } from "@/components/landing/home-section";
import { trackEvent } from "@/features/analytics/analytics";
import { PHONE_QUERY } from "@/lib/constants/breakpoints";
import { FEED_MAX_PAGES, FEED_PAGE_SIZE } from "@/lib/constants/homepage";
import { formatNumber } from "@/lib/format";
import type { FeedPage, ProductCardData } from "@/features/catalog/types";
import type { HomeSection } from "@/features/homepage/types";

type Status = "idle" | "loading" | "error" | "done";
type CategoryChip = { slug: string; name: string; count: number };

const SKELETONS = 4;
/** Start loading this far before the shopper reaches the end. */
const PRELOAD_MARGIN = "900px 0px";
/**
 * Batches that load on their own as the shopper scrolls; the rest wait for a
 * tap. On phones the third batch waits, so 40 products arrive without asking
 * (Baymard: 15–30 per load on mobile) and the page below stays reachable.
 */
const AUTO_PAGES = { phone: 2, other: FEED_MAX_PAGES };

/**
 * The catalogue, most popular first: 20 products at a time, at most three
 * times, then "View all" leads to the full listing (filters, sorting, pages).
 * The first page is server-rendered (crawlable); later pages use keyset
 * cursors, so batches never overlap, and ids are de-duplicated as a second
 * guard. One request at a time; the button works without scrolling.
 */
export default function HomeFeed({ section, title, description, initialPage, categories, catalogueTotal, salesMode }: {
  section: HomeSection;
  title: string;
  description: string;
  initialPage: FeedPage;
  categories: CategoryChip[];
  /** Active products in the store: the "All" count. */
  catalogueTotal: number;
  salesMode: "wholesale" | "retail";
}) {
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<ProductCardData[]>(initialPage.items);
  const [pages, setPagesState] = useState(1);
  const [status, setStatusState] = useState<Status>(initialPage.nextCursor ? "idle" : "done");
  const [announcement, setAnnouncement] = useState("");

  // Mirrors for the observer callback, which outlives renders.
  const statusRef = useRef<Status>(status);
  const pagesRef = useRef(1);
  const autoPages = useRef(AUTO_PAGES.other);
  const setStatus = (next: Status) => {
    statusRef.current = next;
    setStatusState(next);
  };
  const setPages = (next: number) => {
    pagesRef.current = next;
    setPagesState(next);
  };

  const cursor = useRef<string | null>(initialPage.nextCursor);
  const categoryRef = useRef("");
  const seen = useRef(new Set(initialPage.items.map((item) => item.id)));
  const inFlight = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  /** `reset` starts over (category change); otherwise continues from the cursor. */
  const load = useCallback(async (reset = false) => {
    if (!reset && (inFlight.current || !cursor.current || pagesRef.current >= FEED_MAX_PAGES)) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setStatus("loading");

    const params = new URLSearchParams();
    if (categoryRef.current) params.set("category", categoryRef.current);
    if (!reset && cursor.current) params.set("cursor", cursor.current);
    try {
      const response = await fetch(`/api/v1/catalog/feed?${params}`, { signal: controller.signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error("Feed request failed");
      const page = payload.data as FeedPage;
      if (reset) seen.current = new Set();
      const fresh = page.items.filter((item) => !seen.current.has(item.id));
      fresh.forEach((item) => seen.current.add(item.id));
      cursor.current = page.nextCursor;
      setItems((current) => (reset ? fresh : [...current, ...fresh]));
      setPages(reset ? 1 : pagesRef.current + 1);
      setStatus(page.nextCursor ? "idle" : "done");
      setAnnouncement(page.nextCursor ? `${fresh.length} more products loaded.` : "All products loaded.");
      trackEvent("feed_load", { section: section.key, target: categoryRef.current || "all" });
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setAnnouncement("Could not load more products.");
      console.warn("Home feed", error);
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, [section.key]);

  // How many batches load without a tap depends on the screen; follows rotation and resizing.
  useEffect(() => {
    const phone = window.matchMedia(PHONE_QUERY);
    const update = () => {
      autoPages.current = phone.matches ? AUTO_PAGES.phone : AUTO_PAGES.other;
    };
    update();
    phone.addEventListener("change", update);
    return () => phone.removeEventListener("change", update);
  }, []);

  // Auto-load when the sentinel nears the viewport.
  useEffect(() => {
    const element = sentinel.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    observer.current = new IntersectionObserver((entries) => {
      // After an error, wait for the shopper to press "Try again" instead of retrying on every scroll.
      if (statusRef.current !== "idle" || pagesRef.current >= autoPages.current) return;
      if (entries.some((entry) => entry.isIntersecting)) void load();
    }, { rootMargin: PRELOAD_MARGIN });
    observer.current.observe(element);
    return () => observer.current?.disconnect();
  }, [load]);

  // After a batch lands, re-check: if the sentinel is still in range (tall screens), load the next one.
  useEffect(() => {
    const element = sentinel.current;
    if (status !== "idle" || !element || !observer.current) return;
    observer.current.unobserve(element);
    observer.current.observe(element);
  }, [items.length, status]);

  useEffect(() => () => inFlight.current?.abort(), []);

  function chooseCategory(slug: string) {
    if (slug === categoryRef.current) return;
    categoryRef.current = slug;
    setCategory(slug);
    setItems([]);
    void load(true);
  }

  const headingId = `home-${section.key}`;
  const activeChip = categories.find((chip) => chip.slug === category);
  const total = activeChip ? activeChip.count : catalogueTotal;
  const remaining = Math.max(0, total - items.length);
  const catalogueHref = category ? `/categories/${category}` : section.viewAllHref || "/products?sort=popular";
  const capped = status === "idle" && pages >= FEED_MAX_PAGES;

  return (
    <section className={["home-section home-feed content-width", visibilityClass(section)].filter(Boolean).join(" ")} aria-labelledby={headingId} data-home-section={section.key}>
      <div className="home-section__head">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <Link className="home-section__more" href={catalogueHref} data-view-all="header">
          See full catalogue
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      {categories.length > 1 ? (
        <div className="home-feed__filters" role="group" aria-label="Filter products by category">
          <button type="button" className="quick-pick" aria-pressed={category === ""} onClick={() => chooseCategory("")}>
            All
          </button>
          {categories.map((chip) => (
            <button
              key={chip.slug}
              type="button"
              className="quick-pick"
              aria-pressed={category === chip.slug}
              onClick={() => chooseCategory(chip.slug)}
            >
              {chip.name}
              <span className="quick-pick__count">{chip.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <ul className="catalog-grid" aria-label={activeChip ? `${activeChip.name} products` : "All products"} aria-busy={status === "loading"}>
        {items.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} salesMode={salesMode} />
          </li>
        ))}
        {status === "loading"
          ? Array.from({ length: SKELETONS }, (_, index) => (
              <li key={`skeleton-${index}`}>
                <CatalogCardSkeleton />
              </li>
            ))
          : null}
      </ul>

      <div ref={sentinel} className="home-feed__sentinel" aria-hidden="true" />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="home-feed__footer">
        {status === "error" ? (
          <div role="alert" className="home-feed__error">
            <span>We couldn&apos;t load more products.</span>
            <button type="button" className="button button-glass" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : capped ? (
          <Button href={catalogueHref} icon={<ArrowRight size={16} aria-hidden="true" />} data-view-all="end">
            View all {formatNumber(total)} {total === 1 ? "design" : "designs"}
          </Button>
        ) : status === "idle" ? (
          <button type="button" className="button button-glass" onClick={() => void load()}>
            Show {formatNumber(Math.min(FEED_PAGE_SIZE, remaining || FEED_PAGE_SIZE))} more
          </button>
        ) : status === "done" ? (
          <p className="home-feed__end">
            {items.length ? "You've seen everything here." : "No products in this category yet."}{" "}
            <Link href={catalogueHref}>Browse with filters</Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
