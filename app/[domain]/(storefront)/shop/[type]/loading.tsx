import CatalogSkeleton from "@/components/ui/loaders/catalog-skeleton";

/** Also the Suspense boundary the page's params and searchParams need (as for categories). */
export default function ProductTypeLoading() {
  return <CatalogSkeleton />;
}
