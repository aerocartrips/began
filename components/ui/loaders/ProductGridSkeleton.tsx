import ProductCardSkeleton from "@/components/ui/loaders/ProductCardSkeleton";

type ProductGridSkeletonProps = {
  count?: number;
};

export default function ProductGridSkeleton({ count = 9 }: ProductGridSkeletonProps) {
  return (
    <div className="product-grid" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
