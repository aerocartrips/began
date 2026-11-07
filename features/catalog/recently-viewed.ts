import { createPersistentStore } from "@/lib/client/persistent-store";
import { MAX_SECTION_PRODUCTS } from "@/lib/constants/homepage";

const OBJECT_ID = /^[a-f\d]{24}$/i;
/** Enough to fill the home page "Recently viewed" row. */
const MAX_ITEMS = MAX_SECTION_PRODUCTS;

/** Products this browser viewed recently, most recent first. */
export const recentlyViewedStore = createPersistentStore<string[]>("recently-viewed:v1", [], (raw) =>
  Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && OBJECT_ID.test(id)).slice(0, MAX_ITEMS) : [],
);

export function recordProductView(productId: string) {
  recentlyViewedStore.set((ids) => [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX_ITEMS));
}
