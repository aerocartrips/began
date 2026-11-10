import Skeleton from "@/components/ui/loaders/skeleton";

/**
 * Placeholder with the same box and variants as components/catalog/product-card.tsx
 * (full: two-line name, price and details; compact: one line of each), so loading
 * never shifts layout.
 */
export default function CatalogCardSkeleton({ variant = "full" }: { variant?: "full" | "compact" }) {
  const compact = variant === "compact";
  return (
    <article className={compact ? "catalog-card catalog-card--compact" : "catalog-card"} aria-hidden="true">
      <div className="catalog-card__media">
        <Skeleton className="ui-image-skeleton" rounded="none" />
      </div>
      <div className="catalog-card__body">
        <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
        {compact ? null : <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />}
        <Skeleton className="ui-skeleton-line ui-skeleton-line--price" />
        <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
        {compact ? null : <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />}
      </div>
    </article>
  );
}
