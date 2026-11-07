import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductCard from "@/components/catalog/product-card";
import RailScroller from "@/components/catalog/rail-scroller";
import { formatNumber } from "@/lib/format";
import type { ProductCardData } from "@/features/catalog/types";

/** Card widths per breakpoint follow --rail-visible in app/catalog.css. */
const RAIL_SIZES = "(max-width: 480px) 40vw, (max-width: 760px) 30vw, (max-width: 1100px) 22vw, 200px";

/** Where a row's "View all" card leads, and how many products that page lists (when known). */
export type RailViewAll = { href: string; count?: number | null };

/**
 * The one product row used across the store (home page rows, product page
 * suggestions): compact cards in a single line that swipes on touch screens
 * and pages with buttons on desktop, ending in a "View all" card the size of a
 * product card. Renders on the server; only the scrolling controls hydrate.
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
          <ProductCard product={product} salesMode={salesMode} sizes={RAIL_SIZES} variant="compact" />
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
