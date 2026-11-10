import Skeleton from "@/components/ui/loaders/skeleton";
import ProductGridSkeleton from "@/components/ui/loaders/product-grid-skeleton";

/** Options drawn under each filter group in the sidebar placeholder. */
const FILTER_GROUPS = [5, 4, 4, 3];

/**
 * The catalogue loading in its own frame (components/catalog/catalog-view.tsx and
 * catalog-layout.tsx): heading, filter sidebar, toolbar and cards, so nothing jumps
 * when the results arrive. Phones show only the toolbar: their filters live in a sheet.
 */
export default function CatalogSkeleton() {
  return (
    <main className="catalog-page content-width">
      <header className="catalog-header catalog-skeleton__header" aria-hidden="true">
        <Skeleton className="catalog-skeleton__title" />
      </header>
      <div className="catalog-layout">
        <div className="catalog-skeleton__sidebar" aria-hidden="true">
          <Skeleton className="catalog-skeleton__heading" />
          {FILTER_GROUPS.map((options, group) => (
            <div key={group} className="catalog-skeleton__group">
              <Skeleton className="catalog-skeleton__group-title" />
              {Array.from({ length: options }, (_, option) => (
                <Skeleton key={option} className="catalog-skeleton__option" />
              ))}
            </div>
          ))}
        </div>
        <div className="catalog-results">
          <div className="catalog-toolbar" aria-hidden="true">
            <Skeleton className="catalog-toolbar__count catalog-skeleton__count" />
            {/* catalog-sort carries the sort field's height (app/form-controls.css, app/mobile.css). */}
            <Skeleton className="catalog-sort catalog-skeleton__sort" />
            <Skeleton className="catalog-skeleton__filter" rounded="pill" />
          </div>
          <ProductGridSkeleton />
        </div>
      </div>
    </main>
  );
}
