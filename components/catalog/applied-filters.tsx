import Link from "next/link";
import { X } from "lucide-react";
import { catalogHref, hasActiveFilters, toggleValue } from "@/features/catalog/query-string";
import { formatRupees } from "@/lib/format";
import type { CatalogQuery } from "@/features/catalog/types";

/** Short values ("M", "32", "Yes") read better with their filter's name: "Size: M". */
const needsName = (value: string) => value.length <= 4 || /^\d/.test(value);

/** Removable chips for every applied filter, plus "Clear all". */
export default function AppliedFilters({ basePath, query, names, typeName }: {
  basePath: string;
  query: CatalogQuery;
  /** Filter names by attribute key. */
  names: Record<string, string>;
  /** The product type picked with `?type=` on the catalogue, when there is one. */
  typeName?: string | null;
}) {
  const typeChip = Boolean(query.type && typeName && !basePath.startsWith("/shop/"));
  if (!hasActiveFilters(query) && !typeChip) return null;

  const chips: { label: string; href: string }[] = [];
  if (query.q) {
    chips.push({ label: `Search: ${query.q}`, href: catalogHref(basePath, query, { q: "", sort: "newest" }) });
  }
  if (typeChip) chips.push({ label: typeName ?? query.type, href: catalogHref(basePath, query, { type: "" }) });
  for (const [key, values] of Object.entries(query.filters)) {
    for (const value of values) {
      chips.push({
        label: needsName(value) && names[key] ? `${names[key]}: ${value}` : value,
        href: catalogHref(basePath, query, { filters: { [key]: toggleValue(values, value) } }),
      });
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
