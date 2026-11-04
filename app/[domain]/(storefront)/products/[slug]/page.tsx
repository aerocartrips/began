import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductDetailClient from "@/components/catalog/product-detail-client";
import ProductGrid from "@/components/catalog/product-grid";
import RecentlyViewed from "@/components/catalog/recently-viewed";
import ProductReviewsSection from "@/components/reviews/product-reviews-section";
import JsonLd from "@/components/seo/json-ld";
import { getPopularProductSlugs, getProductDetail, getRelatedProducts } from "@/lib/catalog/query";
import { getCurrentTenant } from "@/lib/tenant/current";
import { BUILD_PLACEHOLDER_DOMAIN } from "@/lib/tenant/host";
import { domain } from "next/root-params";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

/** Prerender the most popular products; the rest render on first visit and are cached. */
export async function generateStaticParams() {
  if ((await domain()) === BUILD_PLACEHOLDER_DOMAIN) return [{ slug: "placeholder" }];
  const tenant = await getCurrentTenant();
  const slugs = await getPopularProductSlugs(tenant.id, 50);
  return (slugs.length ? slugs : ["placeholder"]).map((slug) => ({ slug }));
}

async function loadProduct(slug: string) {
  const tenant = await getCurrentTenant();
  const product = await getProductDetail(tenant.id, tenant.salesMode, slug);
  return { tenant, product };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await loadProduct(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.seoTitle,
    description: product.seoDescription || undefined,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.seoTitle,
      description: product.seoDescription || undefined,
      images: product.images.slice(0, 1).map((image) => ({ url: image.url, alt: image.alt })),
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const { tenant, product } = await loadProduct(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(tenant.id, tenant.salesMode, product.id, product.category?.slug ?? null);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.seoDescription || product.shortDescription,
    image: product.images.map((image) => image.url),
    brand: { "@type": "Brand", name: tenant.name },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.price,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `https://${tenant.primaryDomain}/products/${product.slug}`,
    },
    ...(product.rating.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating.average, reviewCount: product.rating.count } }
      : {}),
  };

  return (
    <main className="product-detail-page content-width">
      <JsonLd data={structuredData} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/products">Catalogue</Link>
        {product.category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/categories/${product.category.slug}`}>{product.category.name}</Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <ProductDetailClient product={product} salesMode={tenant.salesMode} />

      <div className="product-detail-sections">
        {product.specs.length > 0 ? (
          <section aria-labelledby="specs-heading">
            <h2 id="specs-heading">Specifications</h2>
            <dl className="saree-specifications">
              {product.specs.map((spec) => (
                <div key={spec.label}>
                  <dt>{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        {product.description ? (
          <section aria-labelledby="description-heading">
            <h2 id="description-heading">Description</h2>
            <div className="product-description">
              {product.description.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </section>
        ) : null}
        <section aria-labelledby="care-heading">
          <h2 id="care-heading">Care &amp; delivery</h2>
          <p>{product.careInstructions || "Dry clean recommended for silk and zari work. Store folded in muslin, away from damp."}</p>
          <p>
            See our <Link href="/care-guide">saree care guide</Link>, <Link href="/shipping">shipping</Link> and{" "}
            <Link href="/returns">returns</Link> policies.
          </p>
        </section>
      </div>

      <ProductReviewsSection productId={product.id} />

      {related.length > 0 ? (
        <section className="product-strip" aria-labelledby="related-heading">
          <h2 id="related-heading">You may also like</h2>
          <ProductGrid products={related} salesMode={tenant.salesMode} label="Related products" />
        </section>
      ) : null}
      <RecentlyViewed excludeId={product.id} salesMode={tenant.salesMode} />
    </main>
  );
}
