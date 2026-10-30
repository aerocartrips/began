"use client";

import Link from "next/link";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import Button from "@/components/ui/button";
import ProductGallery from "@/components/marketplace/product-gallery";
import ProductPurchasePanel from "@/components/marketplace/product-purchase-panel";
import ProductCard from "@/components/marketplace/product-card";
import ProductRatingInline from "@/components/reviews/ProductRatingInline";
import ProductReviewsSection from "@/components/reviews/ProductReviewsSection";
import { useProductCatalog } from "@/features/products/product-catalog-provider";
import { formatCurrency } from "@/lib/format-currency";

function isDatabaseProductId(id: string) {
  return /^[a-f0-9]{24}$/i.test(id);
}

export default function ProductDetailClient({ slug }: { slug: string }) {
  const { products } = useProductCatalog();
  const product = products.find((item) => item.slug === slug && item.status === "published");

  if (!product) {
    return (
      <main className="product-detail-page content-width">
        <EmptyState
          title="This saree is unavailable"
          description="It may have been removed from the temporary catalog session."
          action={<Button href="/products">Back to catalog</Button>}
        />
      </main>
    );
  }

  const relatedProducts = products.filter((item) => item.id !== product.id && item.status === "published");

  return (
    <main className="product-detail-page content-width">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/products">Catalog</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{product.title}</span>
      </nav>
      <div className="product-detail-grid">
        <ProductGallery product={product} />
        <div className="product-detail-copy">
          <Badge>{product.category}</Badge>
          <h1>{product.title}</h1>
          {isDatabaseProductId(product.id) ? (
            <ProductRatingInline
              productId={product.id}
              onScrollToReviews={() =>
                document.getElementById("product-reviews")?.scrollIntoView({ behavior: "smooth" })
              }
            />
          ) : null}
          <p className="product-detail-origin">{product.details}</p>
          <div className="product-detail-price">
            <strong>{formatCurrency(product.priceCents, product.currency)}<span>/pc</span></strong>
            {product.compareAtPriceCents && (
              <del>{formatCurrency(product.compareAtPriceCents, product.currency)}</del>
            )}
          </div>
          <p className="product-description">{product.description}</p>
          <dl className="saree-specifications">
            <div><dt>Fabric</dt><dd>{product.saree.fabric}</dd></div>
            <div><dt>Weave</dt><dd>{product.saree.weave}</dd></div>
            <div><dt>Color</dt><dd>{product.saree.color}</dd></div>
            <div><dt>Work</dt><dd>{product.saree.embellishment}</dd></div>
            <div><dt>Length</dt><dd>{product.saree.lengthMeters} m</dd></div>
            <div><dt>Blouse piece</dt><dd>{product.saree.blousePiece ? "Included" : "Not included"}</dd></div>
            <div><dt>Care</dt><dd>{product.saree.washCare}</dd></div>
          </dl>
          <p className="product-availability">
            <span />{product.inventory >= product.minimumOrderQuantity
              ? `${product.inventory.toLocaleString("en-US")} units available`
              : "Currently unavailable"}
          </p>
          <ProductPurchasePanel key={product.id} product={product} />
          <div className="product-shipping">
            <h2>Shipping and fulfillment</h2>
            <p>{product.shippingDetails}</p>
          </div>
        </div>
      </div>
      {isDatabaseProductId(product.id) ? <ProductReviewsSection productId={product.id} /> : null}
      {relatedProducts.length > 0 && (
        <section className="related-products" aria-labelledby="related-heading">
          <h2 id="related-heading">You may also like</h2>
          <div className="product-grid">
            {relatedProducts.map((item) => <ProductCard product={item} key={item.id} />)}
          </div>
        </section>
      )}
    </main>
  );
}