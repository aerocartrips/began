import Skeleton from "@/components/ui/loaders/skeleton";
import ProductGridSkeleton from "@/components/ui/loaders/product-grid-skeleton";

export default function ProductDetailSkeleton() {
  return (
    <main className="product-detail-page content-width" aria-busy="true" aria-live="polite">
      <div className="product-detail-grid">
        <Skeleton className="ui-skeleton-product-detail-gallery" rounded="card" />
        <div className="product-detail-copy">
          <Skeleton className="ui-skeleton-line ui-skeleton-line--eyebrow" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--hero" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--price" />
          <Skeleton className="ui-skeleton-panel" rounded="card" />
        </div>
      </div>
      <section className="related-products">
        <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
        <ProductGridSkeleton count={3} />
      </section>
    </main>
  );
}
