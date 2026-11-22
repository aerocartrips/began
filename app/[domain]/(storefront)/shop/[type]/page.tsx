import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import CatalogView from "@/components/catalog/catalog-view";
import { findMovedTypeSlug, parseCatalogQuery, searchCatalog } from "@/lib/catalog/query";
import { getCatalogConfig, sellingTypes, typeBySlug } from "@/lib/catalog/catalog-config";
import { typeDescription } from "@/lib/seo/descriptions";
import { isPlainListing, listingImage, listingMetadata } from "@/lib/seo/metadata";
import { storeOrigin } from "@/lib/seo/urls";
import { getCurrentTenant } from "@/lib/tenant/current";

type ProductTypePageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const searchOf = (search: Record<string, string | string[] | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    for (const entry of Array.isArray(value) ? value : value ? [value] : []) params.append(key, entry);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

/**
 * One product type's listing (/shop/t-shirts), with the filters that type's
 * details and options offer. A store selling a single type lists it at
 * /products, so its /shop/ address redirects there; a renamed type's old
 * address redirects to its current one; unknown types show the not-found page.
 */
async function loadType(props: ProductTypePageProps) {
  const [{ type: slug }, search, tenant] = await Promise.all([props.params, props.searchParams, getCurrentTenant()]);
  const config = await getCatalogConfig(tenant.id);
  const type = typeBySlug(config, slug);
  if (!type) {
    const moved = await findMovedTypeSlug(tenant.id, slug);
    if (moved) permanentRedirect(`/shop/${moved}${searchOf(search)}`);
    notFound();
  }
  const selling = sellingTypes(config);
  if (selling.length === 1 && selling[0].id === type.id) permanentRedirect(`/products${searchOf(search)}`);

  const query = parseCatalogQuery(search, { type: type.slug }, config);
  const result = await searchCatalog(tenant.id, tenant.salesMode, query);
  if (query.page > 1 && query.page > result.pageCount) notFound();
  return { tenant, config, type, query, result };
}

export async function generateMetadata(props: ProductTypePageProps): Promise<Metadata> {
  const { tenant, type, query, result } = await loadType(props);
  const basePath = `/shop/${type.slug}`;
  return listingMetadata(tenant, {
    basePath,
    title: type.pluralName,
    description: typeDescription(tenant, type, isPlainListing(query, basePath) ? result.total : null),
    query,
    result,
    image: listingImage(result),
  });
}

export default async function ProductTypePage(props: ProductTypePageProps) {
  const { tenant, config, type, query } = await loadType(props);
  return (
    <CatalogView
      tenant={tenant}
      config={config}
      query={query}
      basePath={`/shop/${type.slug}`}
      title={type.pluralName}
      description={type.description}
      breadcrumbs={{
        origin: storeOrigin(tenant),
        crumbs: [{ name: "Catalogue", href: "/products" }, { name: type.pluralName, href: `/shop/${type.slug}` }],
      }}
    />
  );
}
