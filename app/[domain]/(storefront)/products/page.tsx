import type { Metadata } from "next";
import CatalogView from "@/components/catalog/catalog-view";
import { parseCatalogQuery } from "@/lib/catalog/query";
import { getCurrentTenant } from "@/lib/tenant/current";

type ProductsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const term = Array.isArray(q) ? q[0] : q;
  return term
    ? { title: `Search: ${term}`, robots: { index: false, follow: true } }
    : { title: "All products", description: "Browse the full saree catalogue.", alternates: { canonical: "/products" } };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const [tenant, params] = await Promise.all([getCurrentTenant(), searchParams]);
  const query = parseCatalogQuery(params);
  return (
    <CatalogView
      tenant={tenant}
      query={query}
      basePath="/products"
      title={query.q ? `Results for “${query.q}”` : "All products"}
    />
  );
}
