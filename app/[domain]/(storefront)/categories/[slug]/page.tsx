import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CatalogView from "@/components/catalog/catalog-view";
import { getCategories, parseCatalogQuery } from "@/lib/catalog/query";
import { getCurrentTenant } from "@/lib/tenant/current";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function findCategory(slug: string) {
  const tenant = await getCurrentTenant();
  const category = (await getCategories(tenant.id)).find((entry) => entry.slug === slug.toLowerCase());
  return { tenant, category };
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await findCategory(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description: category.description || `Shop ${category.name}.`,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const { tenant, category } = await findCategory(slug);
  if (!category) notFound();

  return (
    <CatalogView
      tenant={tenant}
      query={parseCatalogQuery(search, { category: category.slug })}
      basePath={`/categories/${category.slug}`}
      title={category.name}
      description={category.description}
    />
  );
}
