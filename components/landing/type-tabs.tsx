"use client";

import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductRail from "@/components/catalog/product-rail";
import CatalogCardSkeleton from "@/components/ui/loaders/catalog-card-skeleton";
import { formatNumber } from "@/lib/format";
import { trackEvent } from "@/features/analytics/analytics";
import type { FeedPage, ProductCardData } from "@/features/catalog/types";

export type TypeTab = { slug: string; name: string; count?: number };

type Panel = { status: "loading" | "ready" | "error"; products: ProductCardData[] };

/** The "All" tab's key. */
const ALL = "";

/**
 * "Shop by type" for stores selling four or more product types: one row with
 * an "All" tab (open first: a card per type) and a tab per type with its most
 * popular products (WAI-ARIA tabs, arrow keys move between them). "All" is
 * server-rendered; a type's products load from the feed API the first time
 * its tab opens, starting as soon as the shopper points at or focuses the
 * tab, so switching feels instant without sending every type with the page.
 */
export default function TypeTabs({ sectionKey, headingId, title, description, types, allPanel, limit, salesMode }: {
  /** The home section (analytics). */
  sectionKey: string;
  headingId: string;
  title: string;
  description?: string;
  types: TypeTab[];
  /** The "All" tab's content (server-rendered): the types themselves. */
  allPanel: ReactNode;
  /** Products per type tab. */
  limit: number;
  salesMode: "wholesale" | "retail";
}) {
  const baseId = useId();
  const tabs: TypeTab[] = [{ slug: ALL, name: "All" }, ...types];
  const [active, setActive] = useState(0);
  const [panels, setPanels] = useState<Record<string, Panel>>({});
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const requested = useRef(new Set([ALL]));
  const current = tabs[active] ?? tabs[0];

  const load = useCallback(
    async (slug: string, retry = false) => {
      if (slug === ALL || (requested.current.has(slug) && !retry)) return;
      requested.current.add(slug);
      setPanels((all) => ({ ...all, [slug]: { status: "loading", products: [] } }));
      try {
        const response = await fetch(`/api/v1/catalog/feed?${new URLSearchParams({ type: slug })}`);
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) throw new Error("Request failed");
        const page = payload.data as FeedPage;
        setPanels((all) => ({ ...all, [slug]: { status: "ready", products: page.items.slice(0, limit) } }));
      } catch {
        setPanels((all) => ({ ...all, [slug]: { status: "error", products: [] } }));
      }
    },
    [limit],
  );

  /** Opens a tab, loading its products the first time (hovering or focusing it may have started that already). */
  function select(index: number) {
    void load(tabs[index].slug);
    setActive(index);
    trackEvent("tab_select", { section: sectionKey, target: tabs[index].slug || "all" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -active, End: tabs.length - 1 - active };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (active + moves[event.key] + tabs.length) % tabs.length;
    select(next);
    buttons.current[next]?.focus();
  }

  const hrefOf = (tab: TypeTab) => (tab.slug ? `/shop/${tab.slug}` : "/products");
  const keyOf = (tab: TypeTab) => tab.slug || "all";

  return (
    <>
      <div className="home-section__head">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <Link className="home-section__more" href={hrefOf(current)} data-view-all="header">
          {current.slug ? `All ${current.name}` : "View all"}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className="product-tabs__list type-tabs__list" role="tablist" aria-labelledby={headingId}>
        {tabs.map((tab, index) => (
          <button
            key={keyOf(tab)}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${keyOf(tab)}`}
            aria-selected={index === active}
            aria-controls={`${baseId}-panel-${keyOf(tab)}`}
            tabIndex={index === active ? 0 : -1}
            className="product-tabs__tab"
            onClick={() => select(index)}
            onKeyDown={onKeyDown}
            onPointerEnter={() => void load(tab.slug)}
            onFocus={() => void load(tab.slug)}
          >
            {tab.name}
            {tab.count !== undefined ? <span className="type-tabs__count">{formatNumber(tab.count)}</span> : null}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => {
        const panel = panels[tab.slug];
        return (
          <div
            key={keyOf(tab)}
            id={`${baseId}-panel-${keyOf(tab)}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${keyOf(tab)}`}
            aria-busy={panel?.status === "loading"}
            hidden={index !== active}
          >
            {tab.slug === ALL ? (
              allPanel
            ) : panel?.status === "ready" ? (
              <ProductRail products={panel.products} salesMode={salesMode} label={tab.name} viewAll={{ href: hrefOf(tab), count: tab.count }} />
            ) : panel?.status === "error" ? (
              <p className="type-tabs__error" role="alert">
                {tab.name} couldn&apos;t load.{" "}
                <button type="button" className="text-button" onClick={() => void load(tab.slug, true)}>
                  Try again
                </button>
              </p>
            ) : index === active ? (
              <ul className="type-tabs__loading" aria-label={`Loading ${tab.name}`}>
                {Array.from({ length: 5 }, (_, skeleton) => (
                  <li key={skeleton}>
                    <CatalogCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
