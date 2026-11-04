"use client";

import { useEffect, useState } from "react";
import HomeSection from "@/components/landing/home-section";
import ProductRail from "@/components/landing/product-rail";
import { recentlyViewedStore } from "@/features/catalog/recently-viewed";
import { wishlistStore } from "@/features/wishlist/wishlist-store";
import { cartStore } from "@/features/cart/cart-store";
import type { ProductCardData, Recommendations } from "@/features/catalog/types";
import type { HomeSection as HomeSectionConfig } from "@/features/homepage/types";

const POPULAR_TITLE = "Popular right now";

/**
 * "Picked for you". The server renders the store's popular products, so the
 * row is useful (and crawlable) before any script runs. When this browser has
 * history (views, wishlist, cart), the row is swapped for personal picks of
 * the same size, so nothing on the page moves.
 */
export default function ForYouRail({ section, initialProducts, salesMode }: {
  section: HomeSectionConfig;
  initialProducts: ProductCardData[];
  salesMode: "wholesale" | "retail";
}) {
  const [picks, setPicks] = useState<Recommendations | null>(null);

  useEffect(() => {
    const viewed = recentlyViewedStore.get();
    const wished = [...wishlistStore.get()].reverse();
    const cart = [...new Set(cartStore.get().map((item) => item.productId))];
    if (!viewed.length && !wished.length && !cart.length) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      viewed: viewed.slice(0, 20).join(","),
      wished: wished.slice(0, 20).join(","),
      cart: cart.slice(0, 20).join(","),
      limit: String(section.limit),
    });
    fetch(`/api/v1/catalog/recommendations?${params}`, { signal: controller.signal, credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const data = payload?.data as Recommendations | undefined;
        if (data?.personalized && data.items.length) setPicks(data);
      })
      .catch(() => undefined); // Keep the popular row.
    return () => controller.abort();
  }, [section.limit]);

  const products = picks?.items ?? initialProducts;
  if (!products.length) return null;
  return (
    <HomeSection
      section={section}
      title={picks ? section.title || "Picked for you" : POPULAR_TITLE}
      description={picks ? picks.reason : section.description}
      viewAll={{ href: section.viewAllHref || "/products?sort=popular" }}
    >
      <ProductRail products={products} salesMode={salesMode} label={picks ? "Picked for you" : POPULAR_TITLE} />
    </HomeSection>
  );
}
