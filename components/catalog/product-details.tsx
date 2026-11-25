import Link from "next/link";
import { Droplets } from "lucide-react";
import PurchaseTermsList from "@/components/catalog/purchase-terms-list";
import type { ProductDetailData } from "@/features/catalog/types";
import { formatNumber } from "@/lib/format";
import type { PurchaseTerm } from "@/lib/catalog/purchase-terms";

/**
 * Everything below the purchase panel that describes the product: the story
 * (description), the facts (specifications) and how to look after it and get
 * it (care, shipping and returns). Rendered on the server; no JavaScript.
 */
export default function ProductDetails({ product, terms, gstRatePercent = 0, showHsn = false }: {
  product: ProductDetailData;
  terms: PurchaseTerm[];
  /** GST rate checkout adds (%); 0 when not set. */
  gstRatePercent?: number;
  /** Business buyers (wholesale stores) need the HSN code for their input tax credit. */
  showHsn?: boolean;
}) {
  const paragraphs = product.description
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const specs = [
    ...product.specs,
    { key: "sku", label: "SKU", value: product.sku },
    ...(gstRatePercent > 0 ? [{ key: "gst", label: "GST", value: `${formatNumber(gstRatePercent)}%, added at checkout` }] : []),
    ...(showHsn && product.hsnCode ? [{ key: "hsn", label: "HSN code", value: product.hsnCode }] : []),
  ];
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
              <div key={spec.key}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="product-details__block product-details__care">
          <h3>Care &amp; delivery</h3>
          {product.careInstructions ? (
            <p className="product-care">
              <Droplets size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{product.careInstructions}</span>
            </p>
          ) : null}
          <PurchaseTermsList terms={delivery} label="Shipping and returns" />
          <p className="product-details__links">
            Read our <Link href="/care-guide">care guide</Link>, <Link href="/shipping">shipping</Link> and{" "}
            <Link href="/returns">returns</Link> policies.
          </p>
        </div>
      </div>
    </section>
  );
}
