import Link from "next/link";
import AppliedFilters from "@/components/catalog/applied-filters";
import CatalogFilters from "@/components/catalog/catalog-filters";
import CatalogFiltersPanel from "@/components/catalog/catalog-filters-panel";
import Pagination from "@/components/catalog/pagination";
import ProductGrid from "@/components/catalog/product-grid";
import { catalogHref } from "@/features/catalog/query-string";
import { getCategories, getFeaturedProducts, searchCatalog } from "@/lib/catalog/query";
import { formatNumber } from "@/lib/format";
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
  const firstItem = (result.page - 1) * 24 + 1;
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

  return (
    <main className="catalog-page content-width">
      <header className="catalog-header">
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        <p className="catalog-count" role="status">
          {result.total === 0
            ? "No products found"
            : `Showing ${formatNumber(firstItem)}–${formatNumber(firstItem + result.items.length - 1)} of ${formatNumber(result.total)}`}
        </p>
      </header>

      <div className="catalog-layout">
        <CatalogFiltersPanel total={result.total} activeCount={activeFilterCount} clearHref={clearFiltersHref}>
          <CatalogFilters basePath={basePath} query={query} result={result} categories={categories} />
        </CatalogFiltersPanel>

        <section className="catalog-results" aria-label="Products">
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
        </section>
      </div>
    </main>
  );
}
