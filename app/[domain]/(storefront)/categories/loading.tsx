import ProductGridSkeleton from "@/components/ui/loaders/product-grid-skeleton";

export default function ProductsLoading() {
  return (
    <main className="catalog-page content-width">
      <ProductGridSkeleton count={9} />
    </main>
  );
}
