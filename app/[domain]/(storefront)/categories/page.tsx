import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import EmptyState from "@/components/ui/empty-state";
import { getCategories } from "@/lib/catalog/query";
import { getCurrentTenant } from "@/lib/tenant/current";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse sarees by category.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const tenant = await getCurrentTenant();
  const categories = (await getCategories(tenant.id)).filter((category) => category.productCount > 0);

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
