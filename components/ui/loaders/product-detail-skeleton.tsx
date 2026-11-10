import Skeleton from "@/components/ui/loaders/skeleton";

/** Placeholder in the product page's own layout, so content lands without shifting. */
export default function ProductDetailSkeleton() {
  return (
    <main className="product-detail-page content-width" aria-busy="true" aria-live="polite">
      <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
      <div className="product-detail-grid" data-photos="one">
        <div className="product-gallery">
          <div className="product-gallery__viewport">
            <Skeleton className="ui-skeleton-stage" rounded="card" />
          </div>
        </div>
        <div className="product-detail-copy">
          <Skeleton className="ui-skeleton-line ui-skeleton-line--eyebrow" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--hero" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--price" />
          <Skeleton className="ui-skeleton-panel" rounded="card" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--button" />
        </div>
      </div>
      <span className="sr-only">Loading product</span>
    </main>
  );
}
