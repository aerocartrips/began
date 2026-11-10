import Skeleton from "@/components/ui/loaders/skeleton";

/** Two full rows at the widest grid (six across). */
const TILES = 12;

/** The category tiles loading in the page's own grid (./page.tsx). */
export default function CategoriesLoading() {
  return (
    <main className="catalog-page content-width">
      <header className="catalog-header catalog-skeleton__header" aria-hidden="true">
        <Skeleton className="catalog-skeleton__title" />
        <Skeleton className="catalog-skeleton__lede" />
      </header>
      <div role="status">
        <span className="sr-only">Loading categories</span>
        <ul className="category-grid" aria-hidden="true">
          {Array.from({ length: TILES }, (_, index) => (
            <li key={index} className="category-tile">
              <span className="category-tile__media">
                <Skeleton className="ui-image-skeleton" rounded="none" />
              </span>
              <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
              <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
