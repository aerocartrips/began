import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import { subtreeTotals } from "@/lib/catalog/category-tree";
import { getCategories } from "@/lib/catalog/query";
import { getCategoryOverview } from "@/lib/catalog/home";
import { getCatalogConfig, sellingTypes } from "@/lib/catalog/catalog-config";
import { groupByType } from "@/lib/catalog/type-mix";
import { inSentence } from "@/lib/catalog/words";
import { buildClientDeliveryUrl } from "@/lib/cloudinary/transformations";
import { shareImage } from "@/lib/seo/images";
import { pageMetadata, siteNameOf } from "@/lib/seo/metadata";
import { getCurrentTenant } from "@/lib/tenant/current";
import { formatNumber } from "@/lib/format";
import type { PublicTenant } from "@/lib/tenant/types";

/**
 * Categories with products, counting their subcategories' (what each category
 * page lists), each with the product type of its top-level category and a
 * photo (its own, else its most popular product's).
 */
async function listedCategories(tenant: PublicTenant) {
  const [categories, overview] = await Promise.all([getCategories(tenant.id), getCategoryOverview(tenant.id, tenant.salesMode)]);
  const totals = subtreeTotals(categories);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const roots = new Map(overview.map((entry) => [entry.id, entry]));
  const rootOf = (id: string) => {
    let current = byId.get(id);
    for (let depth = 0; current?.parentId && byId.has(current.parentId) && depth < 10; depth += 1) current = byId.get(current.parentId);
    return current ? roots.get(current.id) : undefined;
  };
  return categories
    .map((category) => {
      const root = rootOf(category.id);
      const preview = roots.get(category.id)?.previews[0];
      return {
        ...category,
        productCount: totals.get(category.id)?.productCount ?? 0,
        typeId: root?.typeId ?? null,
        imageUrl: category.imageUrl || (preview ? (preview.publicId && buildClientDeliveryUrl(preview.publicId, "productCard")) || preview.url : ""),
      };
    })
    .filter((category) => category.productCount > 0);
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const categories = await listedCategories(tenant);
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

type ListedCategory = Awaited<ReturnType<typeof listedCategories>>[number];

function CategoryGrid({ categories }: { categories: ListedCategory[] }) {
  return (
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
  );
}

export default async function CategoriesPage() {
  const tenant = await getCurrentTenant();
  const [categories, config] = await Promise.all([listedCategories(tenant), getCatalogConfig(tenant.id)]);
  const types = sellingTypes(config);
  // Several product types: categories under the type their products are, then "Collections".
  const groups = types.length > 1 ? groupByType(categories, types) : [];

  return (
    <main className="catalog-page content-width">
      <header className="catalog-header">
        <div>
          <h1>Categories</h1>
          <p>{groups.length > 1 ? `Browse ${types.map((type) => inSentence(type.pluralName)).join(", ")} by category.` : "Explore our collections."}</p>
        </div>
      </header>
      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Products will appear here once they are published."
          action={<Link className="text-link" href="/products">Browse all products</Link>}
        />
      ) : groups.length > 1 ? (
        groups.map((group) => {
          const type = types.find((entry) => entry.id === group.typeId);
          const headingId = `categories-${type?.slug ?? "collections"}`;
          return (
            <section key={headingId} className="category-group" aria-labelledby={headingId}>
              <div className="category-group__head">
                <h2 id={headingId}>{type?.pluralName ?? "Collections"}</h2>
                {type ? (
                  <Link className="category-group__all" href={`/shop/${type.slug}`}>
                    All {inSentence(type.pluralName)} ({formatNumber(type.productCount)})
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
              <CategoryGrid categories={group.items} />
            </section>
          );
        })
      ) : (
        <CategoryGrid categories={categories} />
      )}
    </main>
  );
}
