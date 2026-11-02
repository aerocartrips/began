import Link from "next/link";
import { X } from "lucide-react";
import { catalogHref, hasActiveFilters, toggleValue } from "@/features/catalog/query-string";
import { formatRupees } from "@/lib/format";
import type { CatalogQuery } from "@/features/catalog/types";

const LIST_KEYS = ["fabric", "weave", "color", "occasion"] as const;

/** Removable chips for every applied filter, plus "Clear all". */
export default function AppliedFilters({ basePath, query }: { basePath: string; query: CatalogQuery }) {
  if (!hasActiveFilters(query)) return null;

  const chips: { label: string; href: string }[] = [];
  if (query.q) {
    chips.push({ label: `Search: ${query.q}`, href: catalogHref(basePath, query, { q: "", sort: "newest" }) });
  }
  for (const key of LIST_KEYS) {
    for (const value of query[key]) {
      chips.push({ label: value, href: catalogHref(basePath, query, { [key]: toggleValue(query[key], value) }) });
    }
  }
  if (query.minPrice !== null || query.maxPrice !== null) {
    const min = query.minPrice !== null ? formatRupees(query.minPrice, { compact: true }) : "Any";
    const max = query.maxPrice !== null ? formatRupees(query.maxPrice, { compact: true }) : "Any";
    chips.push({ label: `${min} – ${max}`, href: catalogHref(basePath, query, { minPrice: null, maxPrice: null }) });
  }
  if (query.inStock) chips.push({ label: "In stock", href: catalogHref(basePath, query, { inStock: false }) });

  return (
    <div className="applied-filters" role="group" aria-label="Applied filters">
      {chips.map((chip) => (
        <Link key={chip.href} href={chip.href} className="filter-chip" scroll={false} aria-label={`Remove filter ${chip.label}`}>
          {chip.label}
          <X size={13} aria-hidden="true" />
        </Link>
      ))}
      <Link href={basePath} className="filter-chip filter-chip--clear" scroll={false}>Clear all</Link>
    </div>
  );
}
