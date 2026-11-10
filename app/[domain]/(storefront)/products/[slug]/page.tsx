import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductDetailClient from "@/components/catalog/product-detail-client";
import ProductDetails from "@/components/catalog/product-details";
import ProductRail from "@/components/catalog/product-rail";
import RecentlyViewed from "@/components/catalog/recently-viewed";
import ProductReviewsSection from "@/components/reviews/product-reviews-section";
import JsonLd from "@/components/seo/json-ld";
import { purchaseTerms } from "@/lib/catalog/purchase-terms";
import { getPopularProductSlugs, getProductDetail, getRelatedProducts } from "@/lib/catalog/query";
import { getProductReviewPreview } from "@/lib/catalog/reviews";
import { getStorePolicies } from "@/lib/content/pages";
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

  // All cached per store; none of them waits for another.
  const [related, reviewPreview, policies] = await Promise.all([
    getRelatedProducts(tenant.id, tenant.salesMode, product.id, product.category?.slug ?? null),
    getProductReviewPreview(tenant.id, product.id),
    getStorePolicies(tenant.id),
  ]);
  const terms = purchaseTerms(policies, {
    salesMode: tenant.salesMode,
    paymentsEnabled: Boolean(tenant.razorpayKeyId),
    hasGstin: Boolean(tenant.business.gstin),
  });

  const url = `https://${tenant.primaryDomain}/products/${product.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.seoDescription || product.shortDescription,
    image: product.images.map((image) => image.url),
    brand: { "@type": "Brand", name: tenant.name },
    ...(product.category ? { category: product.category.name } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.price,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
      ...(product.minimumQuantity > 1
        ? { eligibleQuantity: { "@type": "QuantitativeValue", minValue: product.minimumQuantity, unitCode: "C62" } }
        : {}),
    },
    ...(product.rating.count > 0
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating.average, reviewCount: product.rating.count },
          review: reviewPreview.reviews.slice(0, 5).map((review) => ({
            "@type": "Review",
            author: { "@type": "Person", name: review.authorName ?? "Verified buyer" },
            datePublished: review.createdAt?.slice(0, 10),
            reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5 },
            ...(review.title ? { name: review.title } : {}),
            reviewBody: review.comment,
          })),
        }
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
