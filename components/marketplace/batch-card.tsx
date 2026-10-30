import Image from "next/image";
import type { MarketplaceBatch } from "@/data/marketplace";
import { formatCurrency } from "@/lib/format-currency";
import Badge from "@/components/ui/badge";
import AddToCartButton from "@/components/marketplace/add-to-cart-button";

type BatchCardProps = {
  batch: MarketplaceBatch;
};

export default function BatchCard({ batch }: BatchCardProps) {
  return (
    <article className="batch-card">
      <div className="batch-image">
        <Image
          src={batch.images[0].src}
          alt={batch.images[0].alt}
          fill
          sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
          className="cover-image"
        />
        <div className="batch-badges">
          <Badge>MOQ: {batch.minimumOrderQuantity} Units</Badge>
          <Badge tone="dark">In Stock: {batch.inventory.toLocaleString("en-US")}</Badge>
        </div>
      </div>
      <div className="batch-info">
        <div className="batch-heading">
          <div>
            <h3>{batch.title}</h3>
            <p className="batch-origin">{batch.details}</p>
          </div>
          <div className="batch-price">
            <p>{formatCurrency(batch.priceCents, batch.currency)}<span>/pc</span></p>
            {batch.compareAtPriceCents && (
              <del>{formatCurrency(batch.compareAtPriceCents, batch.currency)}</del>
            )}
          </div>
        </div>
        <AddToCartButton
          productId={batch.id}
          quantity={batch.minimumOrderQuantity}
          variant="batch"
          disabled={batch.inventory < batch.minimumOrderQuantity}
        />
      </div>
    </article>
  );
}