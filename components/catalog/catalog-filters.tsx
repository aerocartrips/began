import Link from "next/link";
import AutoSubmitForm from "@/components/catalog/auto-submit-form";
import CatalogSortSelect from "@/components/catalog/catalog-sort-select";
import { CATALOG_SORT_LABELS } from "@/lib/constants/catalog";
import type {
  CatalogFacet,
  CatalogFacetKey,
  CatalogQuery,
  CatalogResult,
  CategorySummary,
} from "@/features/catalog/types";

const FACET_LABELS: Record<CatalogFacetKey, string> = {
  fabric: "Fabric",
  weave: "Weave",
  color: "Colour",
  occasion: "Occasion",
};

const FACET_ORDER: CatalogFacetKey[] = ["fabric", "weave", "color", "occasion"];

function FacetGroup({ name, facets, selected }: { name: CatalogFacetKey; facets: CatalogFacet[]; selected: string[] }) {
  if (facets.length === 0 && selected.length === 0) return null;
  // Selected values stay visible even when no product currently matches them.
  const missing = selected.filter((value) => !facets.some((facet) => facet.value === value));
  const values: CatalogFacet[] = [...facets, ...missing.map((value) => ({ value, count: 0 }))];

  return (
    <fieldset className="catalog-facet">
      <legend>{FACET_LABELS[name]}</legend>
      {values.map((facet) => (
        <label key={facet.value} className="catalog-facet__option">
          <input type="checkbox" name={name} value={facet.value} defaultChecked={selected.includes(facet.value)} />
          {facet.hex ? <span className="swatch" style={{ backgroundColor: facet.hex }} aria-hidden="true" /> : null}
          <span>{facet.value}</span>
          <span className="catalog-facet__count">{facet.count}</span>
        </label>
      ))}
    </fieldset>
  );
}

export default function CatalogFilters({ basePath, query, result, categories }: {
  basePath: string;
  query: CatalogQuery;
  result: CatalogResult;
  categories: CategorySummary[];
}) {
  const isCategoryPage = basePath.startsWith("/categories/");
  const visibleCategories = categories.filter((category) => category.productCount > 0);

  return (
    <AutoSubmitForm action={basePath} className="catalog-filters" label="Filter products">
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
      {query.category && !isCategoryPage ? <input type="hidden" name="category" value={query.category} /> : null}

      <CatalogSortSelect
        // Re-created when the URL's sort changes (back/forward), so it shows the page's sort.
        key={query.sort}
        defaultValue={query.sort}
        options={Object.entries(CATALOG_SORT_LABELS)
          .filter(([value]) => value !== "relevance" || query.q)
          .map(([id, label]) => ({ id, label }))}
      />

      {visibleCategories.length > 0 ? (
        <nav className="catalog-facet" aria-label="Categories">
          <p className="catalog-facet__legend">Category</p>
          <ul className="catalog-category-links">
            {visibleCategories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categories/${category.slug}`}
                  aria-current={query.category === category.slug ? "page" : undefined}
                >
                  {category.name} <span className="catalog-facet__count">{category.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {FACET_ORDER.map((key) => (
        <FacetGroup key={key} name={key} facets={result.facets[key]} selected={query[key]} />
      ))}

      <fieldset className="catalog-facet">
        <legend>Price (₹)</legend>
        <div className="catalog-price-range">
          <label>
            <span className="sr-only">Minimum price</span>
            <input type="number" name="min" min={0} inputMode="numeric" placeholder="Min" defaultValue={query.minPrice ?? ""} />
          </label>
          <span aria-hidden="true">–</span>
          <label>
            <span className="sr-only">Maximum price</span>
            <input type="number" name="max" min={0} inputMode="numeric" placeholder="Max" defaultValue={query.maxPrice ?? ""} />
          </label>
          <button type="submit" className="button button-glass button-sm">Go</button>
        </div>
      </fieldset>

      <label className="catalog-facet__option catalog-stock-toggle">
        <input type="checkbox" name="stock" value="1" defaultChecked={query.inStock} />
        <span>In stock only</span>
      </label>
    </AutoSubmitForm>
  );
}
