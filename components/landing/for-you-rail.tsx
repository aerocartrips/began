"use client";

import { useEffect, useState } from "react";
import HomeSection from "@/components/landing/home-section";
import ProductRail from "@/components/catalog/product-rail";
import { recentlyViewedStore } from "@/features/catalog/recently-viewed";
import { wishlistStore } from "@/features/wishlist/wishlist-store";
import { cartStore } from "@/features/cart/cart-store";
import type { ProductCardData, Recommendations } from "@/features/catalog/types";
import type { HomeSection as HomeSectionConfig } from "@/features/homepage/types";

const POPULAR_TITLE = "Popular right now";
const POPULAR_HREF = "/products?sort=popular";

/**
 * "Picked for you". The server renders the store's popular products, so the
 * row is useful (and crawlable) before any script runs. When this browser has
 * history (views, wishlist, cart), the row is swapped for personal picks of
 * the same size, so nothing on the page moves.
 */
export default function ForYouRail({ section, initialProducts, catalogueTotal, salesMode }: {
  section: HomeSectionConfig;
  initialProducts: ProductCardData[];
  /** Products the "View all" page lists (the whole catalogue, most popular first). */
  catalogueTotal: number;
  salesMode: "wholesale" | "retail";
}) {
  const [picks, setPicks] = useState<Recommendations | null>(null);

  useEffect(() => {
    const viewed = recentlyViewedStore.get();
    const wished = [...wishlistStore.get()].reverse();
    const cart = [...new Set(cartStore.get().map((item) => item.productId))];
    if (!viewed.length && !wished.length && !cart.length) return;

    // A small GET, so cleanup doesn't abort it: an abort surfaces as an unhandled
    // AbortError wherever fetch is wrapped (browser extensions). A late answer is ignored.
    let current = true;
    const params = new URLSearchParams({
      viewed: viewed.slice(0, 20).join(","),
      wished: wished.slice(0, 20).join(","),
      cart: cart.slice(0, 20).join(","),
      limit: String(section.limit),
    });
    fetch(`/api/v1/catalog/recommendations?${params}`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const data = payload?.data as Recommendations | undefined;
        if (current && data?.personalized && data.items.length) setPicks(data);
      })
      .catch(() => undefined); // Keep the popular row.
    return () => {
      current = false;
    };
  }, [section.limit]);

  const products = picks?.items ?? initialProducts;
  if (!products.length) return null;
  const label = picks ? section.title || "Picked for you" : POPULAR_TITLE;
  const viewAll = { href: section.viewAllHref || POPULAR_HREF, count: section.viewAllHref ? null : catalogueTotal };
  return (
    <HomeSection section={section} title={label} description={picks ? picks.reason : section.description} viewAll={viewAll}>
      <ProductRail products={products} salesMode={salesMode} label={label} viewAll={viewAll} />
    </HomeSection>
  );
}
