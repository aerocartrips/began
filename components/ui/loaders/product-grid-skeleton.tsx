import CatalogCardSkeleton from "@/components/ui/loaders/catalog-card-skeleton";

/** Placeholder cards in ProductGrid's own grid (components/catalog/product-grid.tsx), so results land without shifting. */
export default function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div role="status">
      <span className="sr-only">Loading products</span>
      <ul className="catalog-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>
            <CatalogCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
