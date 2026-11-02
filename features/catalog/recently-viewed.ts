import { createPersistentStore } from "@/lib/client/persistent-store";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_ITEMS = 12;

/** Products this browser viewed recently, most recent first. */
export const recentlyViewedStore = createPersistentStore<string[]>("recently-viewed:v1", [], (raw) =>
  Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && OBJECT_ID.test(id)).slice(0, MAX_ITEMS) : [],
);

export function recordProductView(productId: string) {
  recentlyViewedStore.set((ids) => [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX_ITEMS));
}
