import { createPersistentStore } from "@/lib/client/persistent-store";

export type ActivityType = "view" | "wishlist" | "cart";

const MAX_SENT = 200;

/** Events already sent this tab session, so revisits and toggles are not re-sent. */
const sentStore = createPersistentStore<string[]>(
  "activity-sent:v1",
  [],
  (raw) => (Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string").slice(-MAX_SENT) : []),
  "session",
);

/**
 * Tells the store a shopper showed interest in a product (feeds popularity
 * and trending). Fire-and-forget: failures never affect the shopper.
 */
export function trackProductActivity(productId: string, type: ActivityType) {
  if (typeof window === "undefined") return;
  const key = `${type}:${productId}`;
  if (sentStore.get().includes(key)) return;
  sentStore.set((entries) => [...entries, key].slice(-MAX_SENT));
  void fetch("/api/v1/catalog/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, type }),
    keepalive: true,
  }).catch(() => undefined);
}

/** A view counts once the product page has been visible for this long. */
export const MEANINGFUL_VIEW_MS = 4000;
