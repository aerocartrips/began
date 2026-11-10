import Link from "next/link";
import AppliedFilters from "@/components/catalog/applied-filters";
import CatalogFilters from "@/components/catalog/catalog-filters";
import CatalogLayout from "@/components/catalog/catalog-layout";
import CatalogSortSelect from "@/components/catalog/catalog-sort-select";
import Pagination from "@/components/catalog/pagination";
import ProductGrid from "@/components/catalog/product-grid";
import { catalogHref } from "@/features/catalog/query-string";
import { getCategories, getFeaturedProducts, searchCatalog } from "@/lib/catalog/query";
import { CATALOG_PAGE_SIZE, CATALOG_SORT_LABELS } from "@/lib/constants/catalog";
import type { CatalogQuery } from "@/features/catalog/types";
import type { PublicTenant } from "@/lib/tenant/types";

type CatalogViewProps = {
  tenant: PublicTenant;
  query: CatalogQuery;
  basePath: string;
  title: string;
  description?: string;
};

/** Shared listing for /products, /categories/[slug] and search results. */
export default async function CatalogView({ tenant, query, basePath, title, description }: CatalogViewProps) {
  const [result, categories] = await Promise.all([
    searchCatalog(tenant.id, tenant.salesMode, query),
    getCategories(tenant.id),
  ]);
  const suggestions = result.total === 0 ? await getFeaturedProducts(tenant.id, tenant.salesMode, 8) : [];
  const first = (result.page - 1) * CATALOG_PAGE_SIZE + 1;
  const activeFilterCount =
    query.fabric.length +
    query.weave.length +
    query.color.length +
    query.occasion.length +
    (query.minPrice !== null || query.maxPrice !== null ? 1 : 0) +
    (query.inStock ? 1 : 0);
  // Clears the filters but keeps the search term and sort order.
  const clearFiltersHref = catalogHref(basePath, query, {
    fabric: [],
    weave: [],
    color: [],
    occasion: [],
    minPrice: null,
    maxPrice: null,
    inStock: false,
  });
  // "Best match" only means something for a search.
  const sortOptions = Object.entries(CATALOG_SORT_LABELS)
    .filter(([value]) => value !== "relevance" || query.q)
    .map(([id, label]) => ({ id, label }));

  return (
    <main className="catalog-page content-width">
      <header className="catalog-header">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </header>

      <CatalogLayout
        total={result.total}
        range={{ first, last: first + result.items.length - 1 }}
        activeCount={activeFilterCount}
        clearHref={clearFiltersHref}
        filters={<CatalogFilters basePath={basePath} query={query} result={result} categories={categories} />}
        sort={<CatalogSortSelect key={query.sort} basePath={basePath} query={query} options={sortOptions} />}
      >
        <AppliedFilters basePath={basePath} query={query} />
        {result.total > 0 ? (
          <>
            <ProductGrid products={result.items} salesMode={tenant.salesMode} priorityCount={4} label={title} />
            <Pagination basePath={basePath} query={query} pageCount={result.pageCount} />
          </>
        ) : (
          <div className="catalog-empty">
            <h2>{query.q ? `Nothing matches “${query.q}”` : "No products match these filters"}</h2>
            <p>Check the spelling, remove a filter, or browse our popular products below.</p>
            <Link className="text-link" href={basePath}>Clear all filters</Link>
            {suggestions.length > 0 ? (
              <div className="catalog-suggestions">
                <h3>Popular right now</h3>
                <ProductGrid products={suggestions} salesMode={tenant.salesMode} priorityCount={4} label="Popular products" />
              </div>
            ) : null}
          </div>
        )}
      </CatalogLayout>
    </main>
  );
}
