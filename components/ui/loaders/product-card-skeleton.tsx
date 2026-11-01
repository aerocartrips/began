import Skeleton from "@/components/ui/loaders/skeleton";

export default function ProductCardSkeleton() {
  return (
    <article className="batch-card product-card ui-skeleton-card" aria-hidden="true">
      <Skeleton className="product-card-image ui-skeleton-product-image" rounded="none" />
      <div className="batch-info">
        <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
        <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
        <Skeleton className="ui-skeleton-line ui-skeleton-line--button" rounded="control" />
      </div>
    </article>
  );
}
