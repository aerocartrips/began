import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductImage from "@/components/images/product-image";
import ProductTypeIcon from "@/components/catalog/product-type-icon";
import RailScroller from "@/components/catalog/rail-scroller";
import { formatNumber, formatRupees } from "@/lib/format";
import { inSentence } from "@/lib/catalog/words";
import type { TypeShowcase } from "@/features/catalog/types";

type SalesMode = "wholesale" | "retail";

/** One product type: its photo, how many designs, from what price, and the way in. */
function TypeCard({ type, salesMode, sizes }: { type: TypeShowcase; salesMode: SalesMode; sizes: string }) {
  return (
    <Link href={`/shop/${type.slug}`} className="type-card">
      <span className="type-card__media">
        {type.cover ? (
          <ProductImage image={type.cover} preset="productCard" sizes={sizes} />
        ) : (
          <span className="type-card__icon" aria-hidden="true">
            <ProductTypeIcon icon={type.icon} />
          </span>
        )}
      </span>
      <span className="type-card__body">
        <span className="type-card__name">{type.pluralName}</span>
        <span className="type-card__meta">
          {formatNumber(type.productCount)} {type.productCount === 1 ? "design" : "designs"}
          {type.startingPrice > 0 ? (
            <>
              {" · from "}
              {formatRupees(type.startingPrice)}
              {salesMode === "wholesale" ? "/pc" : ""}
            </>
          ) : null}
        </span>
        <span className="type-card__cta">
          Shop {inSentence(type.pluralName)}
          <ArrowRight size={15} aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

/**
 * What the store sells, a card per product type. "grid": large cards side by
 * side, for stores selling two or three types. "row": a swipeable row the
 * size of the product rows (with their arrows), the "All" tab of "Shop by
 * type" in stores selling more.
 */
export default function TypeCards({ types, salesMode, layout = "grid" }: { types: TypeShowcase[]; salesMode: SalesMode; layout?: "grid" | "row" }) {
  if (layout === "row") {
    return (
      <RailScroller label="Product types">
        {types.map((type) => (
          <li key={type.id} className="type-cards__item">
            <TypeCard type={type} salesMode={salesMode} sizes="(max-width: 760px) 45vw, 200px" />
          </li>
        ))}
      </RailScroller>
    );
  }
  return (
    <ul className="type-cards" data-count={types.length}>
      {types.map((type) => (
        <li key={type.id}>
          <TypeCard type={type} salesMode={salesMode} sizes="(max-width: 760px) 90vw, 33vw" />
        </li>
      ))}
    </ul>
  );
}
