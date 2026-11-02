"use client";

import ProductStrip from "@/components/catalog/product-strip";
import { recentlyViewedStore } from "@/features/catalog/recently-viewed";
import { useHydrated } from "@/lib/client/persistent-store";

/** Products this browser viewed recently, excluding the one on screen. */
export default function RecentlyViewed({ excludeId, salesMode }: { excludeId?: string; salesMode: "wholesale" | "retail" }) {
  const hydrated = useHydrated();
  const ids = recentlyViewedStore.use().filter((id) => id !== excludeId).slice(0, 8);
  if (!hydrated || ids.length === 0) return null;
  return <ProductStrip ids={ids} title="Recently viewed" salesMode={salesMode} />;
}
