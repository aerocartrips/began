import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import ProductDetailClient from "@/components/catalog/product-detail-client";
import ProductDetails from "@/components/catalog/product-details";
import ProductRail from "@/components/catalog/product-rail";
import RecentlyViewed from "@/components/catalog/recently-viewed";
import ProductReviewsSection from "@/components/reviews/product-reviews-section";
import Breadcrumbs from "@/components/seo/breadcrumbs";
import JsonLd from "@/components/seo/json-ld";
import { categoryTrail } from "@/lib/catalog/category-tree";
import { purchaseTerms } from "@/lib/catalog/purchase-terms";
import { findMovedProductSlug, getCategories, getPopularProductSlugs, getProductDetail, getRelatedProducts } from "@/lib/catalog/query";
import { getProductReviewPreview } from "@/lib/catalog/reviews";
import { getStorePolicies } from "@/lib/content/pages";
import { productDescription } from "@/lib/seo/descriptions";
import { shareImage } from "@/lib/seo/images";
import { pageMetadata, type SeoImage } from "@/lib/seo/metadata";
import { productJsonLd } from "@/lib/seo/structured-data";
import { storeOrigin } from "@/lib/seo/urls";
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

/**
 * The product at this address (slugs arrive lower-cased by proxy.ts). Unknown
 * slugs show the not-found page, and a renamed product's old slug redirects
 * permanently to its current URL. Once a response has begun streaming (this
 * route has a loading skeleton), Next.js sends these as a noindex tag and an
 * instant redirect tag instead of a 404 or 308 status; search engines treat
 * both the same way.
 */
async function loadProduct(slug: string) {
  const tenant = await getCurrentTenant();
  const product = await getProductDetail(tenant.id, tenant.salesMode, slug);
  if (!product) {
    const moved = await findMovedProductSlug(tenant.id, slug);
    if (moved) permanentRedirect(`/products/${moved}`);
    notFound();
  }
  return { tenant, product };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { tenant, product } = await loadProduct((await params).slug);
  const cover = product.images[0];
  // A 1200×630 card for link previews first, then the full portrait photo (Pinterest prefers tall images).
  const images: SeoImage[] = cover ? [shareImage(cover.url, cover.alt), { url: cover.url, alt: cover.alt }] : [];
  return pageMetadata(tenant, {
    title: product.seoTitle,
    description: productDescription(tenant, product),
    path: `/products/${product.slug}`,
    images: images.filter((image, index) => images.findIndex((other) => other.url === image.url) === index),
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { tenant, product } = await loadProduct((await params).slug);

  // All cached per store; none of them waits for another.
  const [related, reviewPreview, policies, categories] = await Promise.all([
    getRelatedProducts(tenant.id, tenant.salesMode, product.id, product.category?.slug ?? null),
    getProductReviewPreview(tenant.id, product.id),
    getStorePolicies(tenant.id),
    getCategories(tenant.id),
  ]);
  const terms = purchaseTerms(policies, {
    salesMode: tenant.salesMode,
    paymentsEnabled: Boolean(tenant.razorpayKeyId),
    hasGstin: Boolean(tenant.business.gstin),
  });

  // The category and its parents, as in the catalogue's own breadcrumbs.
  const trail = product.category ? categoryTrail(categories, product.category.slug) : [];
  const crumbs = [
    { name: "Catalogue", href: "/products" },
    ...(trail.length ? trail : product.category ? [product.category] : []).map((category) => ({
      name: category.name,
      href: `/categories/${category.slug}`,
    })),
    { name: product.name },
  ];

  return (
    <main className="product-detail-page content-width">
      <JsonLd data={productJsonLd({ tenant, product, reviews: reviewPreview.reviews, policies })} />
      <Breadcrumbs origin={storeOrigin(tenant)} crumbs={crumbs} />

      <ProductDetailClient
        product={product}
        salesMode={tenant.salesMode}
        lowStockThreshold={policies.lowStockThreshold}
        terms={terms}
      />

      <ProductDetails product={product} terms={terms} />

      <ProductReviewsSection
        key={product.id}
        productId={product.id}
        salesMode={tenant.salesMode}
        summary={{ average: product.rating.average, count: product.rating.count, distribution: product.ratingDistribution }}
        initialReviews={reviewPreview.reviews}
        initialTotal={reviewPreview.total}
      />

      {related.length > 0 ? (
        <section className="product-strip" aria-labelledby="related-heading">
          <h2 id="related-heading">You may also like</h2>
          <ProductRail
            products={related}
            salesMode={tenant.salesMode}
            label="Related products"
            viewAll={product.category ? { href: `/categories/${product.category.slug}` } : null}
          />
        </section>
      ) : null}
      <RecentlyViewed exclude={[product.id]} salesMode={tenant.salesMode} />
    </main>
  );
}
