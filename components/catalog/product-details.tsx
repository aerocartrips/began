import Link from "next/link";
import { Droplets } from "lucide-react";
import PurchaseTermsList from "@/components/catalog/purchase-terms-list";
import type { ProductDetailData } from "@/features/catalog/types";
import type { PurchaseTerm } from "@/lib/catalog/purchase-terms";

const DEFAULT_CARE = "Dry clean recommended for silk and zari work. Store folded in muslin, away from damp.";

/**
 * Everything below the purchase panel that describes the product: the story
 * (description), the facts (specifications) and how to look after it and get
 * it (care, shipping and returns). Rendered on the server; no JavaScript.
 */
export default function ProductDetails({ product, terms }: { product: ProductDetailData; terms: PurchaseTerm[] }) {
  const paragraphs = product.description
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const specs = [...product.specs, { label: "SKU", value: product.sku }];
  const delivery = terms.filter((term) => term.key === "shipping" || term.key === "returns");

  return (
    <section className="product-details" aria-labelledby="product-details-heading">
      <h2 id="product-details-heading" className="product-section-title">Product details</h2>
      <div className={paragraphs.length > 0 ? "product-details__grid" : "product-details__grid product-details__grid--no-description"}>
        {paragraphs.length > 0 ? (
          <div className="product-details__block product-details__description">
            <h3>Description</h3>
            <div className="product-prose">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="product-details__block product-details__specs">
          <h3>Specifications</h3>
          <dl className="product-specs">
            {specs.map((spec) => (
              <div key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="product-details__block product-details__care">
          <h3>Care &amp; delivery</h3>
          <p className="product-care">
            <Droplets size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{product.careInstructions || DEFAULT_CARE}</span>
          </p>
          <PurchaseTermsList terms={delivery} label="Shipping and returns" />
          <p className="product-details__links">
            Read our <Link href="/care-guide">saree care guide</Link>, <Link href="/shipping">shipping</Link> and{" "}
            <Link href="/returns">returns</Link> policies.
          </p>
        </div>
      </div>
    </section>
  );
}
