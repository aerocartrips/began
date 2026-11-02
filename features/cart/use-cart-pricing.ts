"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartItem, CartPricing } from "@/features/cart/types";

type PricingState = { pricing: CartPricing | null; error: string | null; key: string | null };

/**
 * Prices items on the server (current prices, tiers, MOQ, stock and GST) and
 * re-prices when they change. The latest request wins; stale ones are aborted.
 */
export function useCartPricing(items: CartItem[]) {
  const key = useMemo(() => JSON.stringify(items), [items]);
  const [state, setState] = useState<PricingState>({ pricing: null, error: null, key: null });

  useEffect(() => {
    if (key === "[]") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/v1/cart/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: `{"items":${key}}`,
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message ?? "Prices could not be loaded.");
        setState({ pricing: payload.data, error: null, key });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : "Prices could not be loaded.", key }));
      }
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [key]);

  const empty = items.length === 0;
  return {
    pricing: empty ? null : state.pricing,
    error: empty ? null : state.error,
    loading: !empty && state.key !== key,
  };
}
