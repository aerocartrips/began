import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import CatalogView from "@/components/catalog/catalog-view";
import { categoryTrail } from "@/lib/catalog/category-tree";
import { findMovedCategorySlug, getCategories, parseCatalogQuery, searchCatalog } from "@/lib/catalog/query";
import { categoryDescription } from "@/lib/seo/descriptions";
import { shareImage } from "@/lib/seo/images";
import { isPlainListing, listingImage, listingMetadata } from "@/lib/seo/metadata";
import { storeOrigin } from "@/lib/seo/urls";
import { getCurrentTenant } from "@/lib/tenant/current";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
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
 * The category at this address (slugs arrive lower-cased by proxy.ts), its
 * listing query and results (cached, and shared with the page). Unknown slugs
 * and pages past the last one show the not-found page (noindex); a renamed
 * category's old slug redirects permanently to its current URL.
 */
async function loadCategory(props: CategoryPageProps) {
  const [{ slug }, search, tenant] = await Promise.all([props.params, props.searchParams, getCurrentTenant()]);
  const categories = await getCategories(tenant.id);
  const category = categories.find((entry) => entry.slug === slug);
  if (!category) {
    const moved = await findMovedCategorySlug(tenant.id, slug);
    if (moved) permanentRedirect(`/categories/${moved}${searchOf(search)}`);
    notFound();
  }

  const query = parseCatalogQuery(search, { category: category.slug });
  const result = await searchCatalog(tenant.id, tenant.salesMode, query);
  if (query.page > 1 && query.page > result.pageCount) notFound();
  return { tenant, categories, category, query, result };
}

export async function generateMetadata(props: CategoryPageProps): Promise<Metadata> {
  const { tenant, category, query, result } = await loadCategory(props);
  return listingMetadata(tenant, {
    basePath: `/categories/${category.slug}`,
    title: category.name,
    description: categoryDescription(tenant, category, isPlainListing(query, `/categories/${category.slug}`) ? result.total : null),
    query,
    result,
    image: category.imageUrl ? shareImage(category.imageUrl, category.name) : listingImage(result),
  });
}

export default async function CategoryPage(props: CategoryPageProps) {
  const { tenant, categories, category, query } = await loadCategory(props);
  const crumbs = [
    { name: "Catalogue", href: "/products" },
    ...categoryTrail(categories, category.slug).map((entry) => ({ name: entry.name, href: `/categories/${entry.slug}` })),
  ];

  return (
    <CatalogView
      tenant={tenant}
      query={query}
      basePath={`/categories/${category.slug}`}
      title={category.name}
      description={category.description}
      breadcrumbs={{ origin: storeOrigin(tenant), crumbs }}
    />
  );
}
