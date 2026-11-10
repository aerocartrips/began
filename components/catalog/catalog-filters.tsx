import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import AutoSubmitForm from "@/components/catalog/auto-submit-form";
import CountBadge from "@/components/ui/count-badge";
import { TextField } from "@/components/ui/form/text-field";
import { formatNumber } from "@/lib/format";
import type { CatalogFacet, CatalogFacetKey, CatalogQuery, CatalogResult, CategorySummary } from "@/features/catalog/types";

const FACET_LABELS: Record<CatalogFacetKey, string> = {
  fabric: "Fabric",
  weave: "Weave",
  color: "Colour",
  occasion: "Occasion",
};

const FACET_ORDER: CatalogFacetKey[] = ["fabric", "weave", "color", "occasion"];

/** Options listed before "+ N more" (the rest are one tap away). */
const VISIBLE_OPTIONS = 6;

/**
 * One collapsible filter group (native <details>, no script). Its badge
 * counts what is selected in it. Groups start open; a group the shopper
 * closes stays closed while they keep filtering.
 */
function FilterGroup({ title, selected = 0, children }: { title: string; selected?: number; children: ReactNode }) {
  return (
    <details className="catalog-facet" open>
      <summary className="catalog-facet__summary">
        <span className="catalog-facet__title">{title}</span>
        <CountBadge count={selected} label="selected" />
        <ChevronDown size={16} strokeWidth={1.8} className="catalog-facet__chevron" aria-hidden="true" />
      </summary>
      <div className="catalog-facet__body">{children}</div>
    </details>
  );
}

/** A list cut to VISIBLE_OPTIONS with the rest behind "+ N more", opened when one of them is selected. */
function ShortList<T>({ items, render, isSelected }: { items: T[]; render: (item: T) => ReactNode; isSelected: (item: T) => boolean }) {
  const head = items.slice(0, VISIBLE_OPTIONS);
  const rest = items.slice(VISIBLE_OPTIONS);
  return (
    <ul className="catalog-options">
      {head.map(render)}
      {rest.length ? (
        <li className="catalog-options__more-item">
          <details className="catalog-options__more" open={rest.some(isSelected) || undefined}>
            <summary>+ {formatNumber(rest.length)} more</summary>
            <ul className="catalog-options">{rest.map(render)}</ul>
          </details>
        </li>
      ) : null}
    </ul>
  );
}

function FacetGroup({ name, facets, selected }: { name: CatalogFacetKey; facets: CatalogFacet[]; selected: string[] }) {
  if (facets.length === 0 && selected.length === 0) return null;
  // Values match whatever their letter case (lib/catalog/query.js); a selected value stays listed even with no matches.
  const chosen = new Set(selected.map((value) => value.toLowerCase()));
  const isSelected = (facet: CatalogFacet) => chosen.has(facet.value.toLowerCase());
  const listed = new Set(facets.map((facet) => facet.value.toLowerCase()));
  const values: CatalogFacet[] = [
    ...facets,
    ...selected.filter((value) => !listed.has(value.toLowerCase())).map((value) => ({ value, count: 0 })),
  ];

  return (
    <FilterGroup title={FACET_LABELS[name]} selected={selected.length}>
      <fieldset className="catalog-facet__options">
        <legend className="sr-only">{FACET_LABELS[name]}</legend>
        <ShortList
          items={values}
          isSelected={isSelected}
          render={(facet) => {
            const checked = isSelected(facet);
            return (
              <li key={facet.value}>
                <label className="catalog-option">
                  {/* Keyed by state: an untouched box follows the URL when a filter is removed elsewhere (chip, Clear all). */}
                  <input key={String(checked)} type="checkbox" name={name} value={facet.value} defaultChecked={checked} />
                  {facet.hex ? <span className="swatch" style={{ backgroundColor: facet.hex }} aria-hidden="true" /> : null}
                  <span className="catalog-option__label">{facet.value}</span>
                  <span className="catalog-option__count">{formatNumber(facet.count)}</span>
                </label>
              </li>
            );
          }}
        />
      </fieldset>
    </FilterGroup>
  );
}

/**
 * The filters (no sort: that sits above the results). A GET form that applies
 * every change at once; it also works without JavaScript.
 */
export default function CatalogFilters({ basePath, query, result, categories }: {
  basePath: string;
  query: CatalogQuery;
  result: CatalogResult;
  categories: CategorySummary[];
}) {
  const isCategoryPage = basePath.startsWith("/categories/");
  const visibleCategories = categories.filter((category) => category.productCount > 0);
  const defaultSort = query.q ? "relevance" : "newest";
  const range = result.priceRange;
  const priced = query.minPrice !== null || query.maxPrice !== null;

  return (
    <AutoSubmitForm action={basePath} className="catalog-filters" label="Filter products">
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
      {query.category && !isCategoryPage ? <input type="hidden" name="category" value={query.category} /> : null}
      {query.sort !== defaultSort ? <input type="hidden" name="sort" value={query.sort} /> : null}

      {visibleCategories.length > 0 ? (
        <FilterGroup title="Category">
          <nav aria-label="Categories">
            <ul className="catalog-options">
              <li>
                <Link className="catalog-option catalog-option--link" href="/products" aria-current={query.category ? undefined : "page"}>
                  <span className="catalog-option__label">All products</span>
                </Link>
              </li>
            </ul>
            <ShortList
              items={visibleCategories}
              isSelected={(category) => category.slug === query.category}
              render={(category) => (
                <li key={category.id}>
                  <Link
                    className="catalog-option catalog-option--link"
                    href={`/categories/${category.slug}`}
                    aria-current={query.category === category.slug ? "page" : undefined}
                  >
                    <span className="catalog-option__label">{category.name}</span>
                    <span className="catalog-option__count">{formatNumber(category.productCount)}</span>
                  </Link>
                </li>
              )}
            />
          </nav>
        </FilterGroup>
      ) : null}

      {FACET_ORDER.map((key) => (
        <FacetGroup key={key} name={key} facets={result.facets[key]} selected={query[key]} />
      ))}

      <FilterGroup title="Price" selected={priced ? 1 : 0}>
        <div className="catalog-price-filter">
          <TextField
            key={`min:${query.minPrice}`}
            label="Min (₹)"
            name="min"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={range ? formatNumber(Math.floor(range.min)) : "0"}
            defaultValue={query.minPrice ?? ""}
            required={false}
          />
          <TextField
            key={`max:${query.maxPrice}`}
            label="Max (₹)"
            name="max"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={range ? formatNumber(Math.ceil(range.max)) : "Any"}
            defaultValue={query.maxPrice ?? ""}
            required={false}
          />
        </div>
        <button type="submit" className="button button-glass button-sm catalog-price-filter__apply">Apply price</button>
      </FilterGroup>

      <FilterGroup title="Availability" selected={query.inStock ? 1 : 0}>
        <label className="account-toggle catalog-stock-toggle">
          <span className="account-toggle-copy">
            <strong>In stock only</strong>
            <small>Hide products that can&apos;t be ordered now</small>
          </span>
          <input key={String(query.inStock)} type="checkbox" role="switch" name="stock" value="1" defaultChecked={query.inStock} />
          <span className="account-switch" aria-hidden="true" />
        </label>
      </FilterGroup>
    </AutoSubmitForm>
  );
}
