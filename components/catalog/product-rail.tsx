import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductCard from "@/components/catalog/product-card";
import RailScroller from "@/components/catalog/rail-scroller";
import { formatNumber } from "@/lib/format";
import type { ProductCardData } from "@/features/catalog/types";

/** Where a row's "View all" card leads, and how many products that page lists (when known). */
export type RailViewAll = { href: string; count?: number | null };

/**
 * The one product row used across the store (home page rows, product page
 * suggestions, recently viewed): the store's product card, the same size as in
 * the grids, in a single line that swipes on touch screens and pages with
 * buttons on desktop, ending in a "View all" card the size of a product card.
 * Renders on the server; only the scrolling controls hydrate.
 */
export default function ProductRail({ products, salesMode, label, viewAll }: {
  products: ProductCardData[];
  salesMode: "wholesale" | "retail";
  label: string;
  viewAll?: RailViewAll | null;
}) {
  return (
    <RailScroller label={label}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} salesMode={salesMode} />
        </li>
      ))}
      {viewAll?.href ? (
        <li>
          <Link className="rail-view-all" href={viewAll.href} data-view-all="end">
            <span className="rail-view-all__icon" aria-hidden="true">
              <ArrowRight size={20} />
            </span>
            <strong>View all</strong>
            {viewAll.count ? (
              <span className="rail-view-all__count">
                {formatNumber(viewAll.count)} {viewAll.count === 1 ? "design" : "designs"}
              </span>
            ) : null}
            <span className="sr-only"> {label}</span>
          </Link>
        </li>
      ) : null}
    </RailScroller>
  );
}
