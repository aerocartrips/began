"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { formatRupees } from "@/lib/format";
import { trackEvent } from "@/features/analytics/analytics";
import type { ProductSuggestion } from "@/features/catalog/types";

type SuggestState = { term: string; hits: ProductSuggestion[] } | null;

/**
 * Header search with suggestions (product photo, name, price) from the
 * catalogue API. Arrow keys move through suggestions; Enter opens the
 * highlighted product or the full results page.
 */
export default function StorefrontSearch() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<SuggestState>(null);
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/v1/catalog/suggest?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((payload) => setResult({ term, hits: payload.success ? payload.data : [] }))
        .catch(() => {
          if (!controller.signal.aborted) setResult({ term, hits: [] });
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const hits = term.length >= 2 && result?.term === term ? result.hits : [];
  const loading = term.length >= 2 && result?.term !== term;

  function go(href: string) {
    // Count the interaction only; the search text itself is never sent.
    trackEvent(href.startsWith("/products/") ? "search_suggestion_click" : "search_submit");
    setOpen(false);
    setActive(-1);
    router.push(href);
  }

  function submit() {
    if (!term) return;
    const selected = hits[active];
    go(selected ? `/products/${selected.slug}` : `/products?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="storefront-search" ref={rootRef}>
      <label className="search-field">
        <span className="sr-only">Search products</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={open && term.length >= 2}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          value={query}
          placeholder="Search sarees, fabric, SKU…"
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, hits.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, -1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <button type="button" className="search-submit" aria-label="Search" onClick={submit}>
          <Search size={14} aria-hidden="true" />
        </button>
      </label>
      {open && term.length >= 2 ? (
        <div className="storefront-search-panel">
          {loading ? <p className="storefront-search-meta">Searching…</p> : null}
          {!loading && hits.length === 0 ? <p className="storefront-search-meta">No matching products.</p> : null}
          <ul id={listId} role="listbox" aria-label="Suggestions">
            {hits.map((hit, index) => (
              <li
                key={hit.slug}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`storefront-search-hit${index === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => go(`/products/${hit.slug}`)}
              >
                <span className="storefront-search-thumb">
                  {hit.imageUrl ? <Image src={hit.imageUrl} alt="" fill sizes="48px" className="cover-image" /> : null}
                </span>
                <span className="storefront-search-copy"><strong>{hit.name}</strong></span>
                <span className="storefront-search-price">{formatRupees(hit.price)}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="storefront-search-all" onClick={() => go(`/products?q=${encodeURIComponent(term)}`)}>
            View all results for “{term}” →
          </button>
        </div>
      ) : null}
    </div>
  );
}
