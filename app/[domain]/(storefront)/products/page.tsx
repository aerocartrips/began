import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CatalogView from "@/components/catalog/catalog-view";
import { parseCatalogQuery, searchCatalog } from "@/lib/catalog/query";
import { catalogueDescription } from "@/lib/seo/descriptions";
import { isPlainListing, listingImage, listingMetadata } from "@/lib/seo/metadata";
import { getCurrentTenant } from "@/lib/tenant/current";

type ProductsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The listing for this address (results are cached and shared with the page).
 * Pages past the last one show the not-found page (noindex).
 */
async function loadListing(searchParams: ProductsPageProps["searchParams"]) {
  const [tenant, params] = await Promise.all([getCurrentTenant(), searchParams]);
  const query = parseCatalogQuery(params);
  const result = await searchCatalog(tenant.id, tenant.salesMode, query);
  if (query.page > 1 && query.page > result.pageCount) notFound();
  return { tenant, query, result };
}

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const { tenant, query, result } = await loadListing(searchParams);
  // Searches, filters and sorts are noindex variations of the catalogue (lib/seo/metadata.ts).
  return listingMetadata(tenant, {
    basePath: "/products",
    title: query.q ? `Search: ${query.q}` : "All products",
    description: catalogueDescription(tenant, isPlainListing(query, "/products") ? result.total : null),
    query,
    result,
    image: listingImage(result),
  });
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { tenant, query } = await loadListing(searchParams);
  return (
    <CatalogView
      tenant={tenant}
      query={query}
      basePath="/products"
      title={query.q ? `Results for “${query.q}”` : "All products"}
    />
  );
}
