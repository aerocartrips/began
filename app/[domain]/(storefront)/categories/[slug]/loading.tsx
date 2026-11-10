import CatalogSkeleton from "@/components/ui/loaders/catalog-skeleton";

/**
 * Also the Suspense boundary the page's params and searchParams need: without it, moving
 * between categories can't show anything until the new one has rendered.
 */
export default function CategoryLoading() {
  return <CatalogSkeleton />;
}
