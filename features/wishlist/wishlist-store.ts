import { createPersistentStore } from "@/lib/client/persistent-store";
import { trackProductActivity } from "@/features/catalog/activity";
import { trackEvent } from "@/features/analytics/analytics";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_ITEMS = 200;

const sanitizeIds = (raw: unknown) =>
  Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === "string" && OBJECT_ID.test(id)))].slice(-MAX_ITEMS) : [];

/** Wishlist product ids; mirrored to the account when the shopper is signed in. */
export const wishlistStore = createPersistentStore<string[]>("wishlist:v1", [], sanitizeIds);

/** "guest" once the API reports no session, so later toggles skip the server. */
const sessionStore = createPersistentStore<"unknown" | "guest" | "synced">(
  "wishlist:session",
  "unknown",
  (raw) => (raw === "guest" || raw === "synced" ? raw : "unknown"),
  "session",
);

async function callServer(method: "POST" | "DELETE" | "PUT", body?: unknown, query = "") {
  if (sessionStore.get() === "guest") return null;
  try {
    const response = await fetch(`/api/v1/wishlist${query}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401) {
      sessionStore.set("guest");
      return null;
    }
    const payload = await response.json();
    return response.ok && Array.isArray(payload.data?.productIds) ? (payload.data.productIds as string[]) : null;
  } catch {
    return null;
  }
}

export const wishlistActions = {
  async toggle(productId: string) {
    const saved = wishlistStore.get().includes(productId);
    wishlistStore.set((ids) => (saved ? ids.filter((id) => id !== productId) : [...ids, productId]));
    if (!saved) {
      trackProductActivity(productId, "wishlist");
      trackEvent("wishlist_add", { target: productId });
    }
    const serverIds = saved
      ? await callServer("DELETE", undefined, `?productId=${productId}`)
      : await callServer("POST", { productId });
    if (serverIds) wishlistStore.set(serverIds);
    return !saved;
  },
  /** Once per tab session: merge local ids into the account (no-op for guests). */
  async sync() {
    if (sessionStore.get() !== "unknown") return;
    const merged = await callServer("PUT", { productIds: wishlistStore.get() });
    if (merged) {
      wishlistStore.set(merged);
      sessionStore.set("synced");
    }
  },
  /** Call after sign-in so the next sync merges into the new account. */
  resetSession() {
    sessionStore.set("unknown");
  },
};

export function useWishlist() {
  return wishlistStore.use();
}
