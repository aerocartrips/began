import Skeleton from "@/components/ui/loaders/skeleton";

/** Placeholder with the same box as components/catalog/product-card.tsx, so loading never shifts layout. */
export default function CatalogCardSkeleton() {
  return (
    <article className="catalog-card" aria-hidden="true">
      <Skeleton className="catalog-card__media" rounded="none" />
      <div className="catalog-card__body">
        <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
        <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
      </div>
    </article>
  );
}
