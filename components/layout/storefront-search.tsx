"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProductCatalog } from "@/features/products/product-catalog-provider";
import { apiRequest } from "@/lib/api/api-client";
import { formatCurrency } from "@/lib/format-currency";

type SearchHit = {
  id: string;
  slug: string;
  title: string;
  sku: string;
  category: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
};

function localSearch(products: ReturnType<typeof useProductCatalog>["products"], term: string) {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  return products
    .filter((product) => product.status === "published")
    .filter((product) =>
      `${product.title} ${product.sku} ${product.category} ${product.details} ${product.saree.fabric} ${product.saree.color}`
        .toLowerCase()
        .includes(q),
    )
    .slice(0, 8)
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      sku: product.sku,
      category: product.category,
      priceCents: product.priceCents,
      currency: product.currency,
      imageUrl: product.images[0]?.src,
    }));
}

export default function StorefrontSearch() {
  const router = useRouter();
  const { products } = useProductCatalog();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remoteHits, setRemoteHits] = useState<SearchHit[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const canUseApi = useMemo(() => /^[a-f0-9]{24}$/i.test(products[0]?.id ?? ""), [products]);

  useEffect(() => {
    if (!query.trim()) {
      setRemoteHits(null); // eslint-disable-line react-hooks/set-state-in-effect -- reset remote hits when query clears
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      if (canUseApi) {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        void apiRequest<Record<string, unknown>[]>(
          `/api/v1/products?search=${encodeURIComponent(query.trim())}&limit=8`,
          { signal: controller.signal },
        )
          .then((result) => {
            const hits = (result.data ?? []).map((item) => {
              const doc = item as Record<string, unknown>;
              const images = Array.isArray(doc.images) ? doc.images : [];
              const image = images[0] as Record<string, unknown> | undefined;
              return {
                id: String(doc._id),
                slug: String(doc.slug),
                title: String(doc.name),
                sku: String(doc.sku),
                category: typeof doc.category === "object" && doc.category && "name" in (doc.category as object)
                  ? String((doc.category as { name?: string }).name)
                  : "Wholesale",
                priceCents: Math.round(Number(doc.wholesalePrice ?? doc.price ?? 0) * 100),
                currency: "USD",
                imageUrl: String(image?.url ?? image?.secureUrl ?? ""),
              } satisfies SearchHit;
            });
            setRemoteHits(hits);
          })
          .catch(() => setRemoteHits([]))
          .finally(() => setLoading(false));
      } else {
        setRemoteHits(null);
        setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [canUseApi, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const hits = remoteHits ?? localSearch(products, query);

  function submitSearch() {
    const term = query.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/products?search=${encodeURIComponent(term)}`);
  }

  return (
    <div className="storefront-search" ref={rootRef}>
      <label className="search-field">
        <span className="sr-only">Search the catalog</span>
        <input
          type="search"
          value={query}
          placeholder="Search sarees, SKU, fabric..."
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitSearch();
            }
            if (event.key === "Escape") setOpen(false);
          }}
        />
        <button type="button" className="search-submit" aria-label="Search catalog" onClick={submitSearch}>
          <Search size={14} aria-hidden="true" />
        </button>
      </label>
      {open && query.trim() ? (
        <div className="storefront-search-panel" role="listbox">
          {loading ? <p className="storefront-search-meta">Searching…</p> : null}
          {!loading && hits.length === 0 ? (
            <p className="storefront-search-meta">No matching products.</p>
          ) : null}
          {hits.map((hit) => (
            <Link
              key={hit.id}
              className="storefront-search-hit"
              href={`/products/${hit.slug}`}
              role="option"
              onClick={() => setOpen(false)}
            >
              <span className="storefront-search-thumb">
                {hit.imageUrl ? (
                  <Image src={hit.imageUrl} alt="" fill sizes="48px" className="cover-image" />
                ) : null}
              </span>
              <span className="storefront-search-copy">
                <strong>{hit.title}</strong>
                <small>{hit.category} · {hit.sku}</small>
              </span>
              <span className="storefront-search-price">{formatCurrency(hit.priceCents, hit.currency as "USD")}</span>
            </Link>
          ))}
          <button type="button" className="storefront-search-all" onClick={submitSearch}>
            View all results for “{query.trim()}” →
          </button>
        </div>
      ) : null}
    </div>
  );
}
