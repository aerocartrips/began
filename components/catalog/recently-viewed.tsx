"use client";

import ProductStrip from "@/components/catalog/product-strip";
import { recentlyViewedStore } from "@/features/catalog/recently-viewed";
import { useHydrated } from "@/lib/client/persistent-store";

/** Products this browser viewed recently, minus `exclude` (the product on screen, or what is in the cart). */
export default function RecentlyViewed({ exclude = [], salesMode }: { exclude?: string[]; salesMode: "wholesale" | "retail" }) {
  const hydrated = useHydrated();
  const ids = recentlyViewedStore.use().filter((id) => !exclude.includes(id)).slice(0, 8);
  if (!hydrated || ids.length === 0) return null;
  return <ProductStrip ids={ids} title="Recently viewed" salesMode={salesMode} />;
}
