"use client";

import HomeSection from "@/components/landing/home-section";
import ProductRail from "@/components/catalog/product-rail";
import { useProductCards } from "@/components/catalog/product-strip";
import { recentlyViewedStore } from "@/features/catalog/recently-viewed";
import { useHydrated } from "@/lib/client/persistent-store";
import type { HomeSection as HomeSectionConfig } from "@/features/homepage/types";

/**
 * Products this browser viewed. The history never leaves the device except
 * as ids to fetch current prices, and the row is hidden when there is none.
 */
export default function RecentlyViewedRail({ section, salesMode }: {
  section: HomeSectionConfig;
  salesMode: "wholesale" | "retail";
}) {
  const hydrated = useHydrated();
  const ids = recentlyViewedStore.use().slice(0, section.limit);
  const { cards } = useProductCards(hydrated ? ids : []);
  if (!hydrated || cards.length === 0) return null;
  const title = section.title || "Recently viewed";
  return (
    <HomeSection section={section} title={title} description={section.description}>
      <ProductRail products={cards} salesMode={salesMode} label={title} />
    </HomeSection>
  );
}
