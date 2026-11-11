import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import EmptyState from "@/components/ui/empty-state";
import { subtreeTotals } from "@/lib/catalog/category-tree";
import { getCategories } from "@/lib/catalog/query";
import { shareImage } from "@/lib/seo/images";
import { pageMetadata, siteNameOf } from "@/lib/seo/metadata";
import { getCurrentTenant } from "@/lib/tenant/current";
import { formatNumber } from "@/lib/format";

/** Categories with products, counting their subcategories' (what each category page lists). */
async function listedCategories(tenantId: string) {
  const categories = await getCategories(tenantId);
  const totals = subtreeTotals(categories);
  return categories
    .map((category) => ({ ...category, productCount: totals.get(category.id)?.productCount ?? 0 }))
    .filter((category) => category.productCount > 0);
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const categories = await listedCategories(tenant.id);
  const names = categories.slice(0, 6).map((category) => category.name);
  const cover = categories.find((category) => category.imageUrl);
  return pageMetadata(tenant, {
    title: "Categories",
    description: `Browse ${siteNameOf(tenant)} by category${names.length ? `: ${names.join(", ")}${categories.length > names.length ? " and more" : ""}` : ""}.`,
    path: "/categories",
    robots: categories.length ? "index" : "noindex",
    images: cover ? [shareImage(cover.imageUrl, cover.name)] : undefined,
  });
}

export default async function CategoriesPage() {
  const tenant = await getCurrentTenant();
  const categories = await listedCategories(tenant.id);

  return (
    <main className="catalog-page content-width">
      <header className="catalog-header">
        <div>
          <h1>Categories</h1>
          <p>Explore our collections.</p>
        </div>
      </header>
      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Products will appear here once they are published."
          action={<Link className="text-link" href="/products">Browse all products</Link>}
        />
      ) : (
        <ul className="category-grid">
          {categories.map((category) => (
            <li key={category.id}>
              <Link href={`/categories/${category.slug}`} className="category-tile">
                <span className="category-tile__media">
                  {category.imageUrl ? (
                    <Image src={category.imageUrl} alt="" fill sizes="(max-width: 640px) 50vw, 25vw" className="cover-image" />
                  ) : null}
                </span>
                <span className="category-tile__name">{category.name}</span>
                <span className="category-tile__count">
                  {formatNumber(category.productCount)} {category.productCount === 1 ? "product" : "products"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
