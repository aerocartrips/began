"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CartItem, CartPricing, PricedCartLine } from "@/features/cart/types";

type PricingState = {
  pricing: CartPricing | null;
  /** The items `pricing` was computed for (as sent). */
  pricedKey: string | null;
  error: string | null;
  /** The items of the last request that finished, successfully or not. */
  settledKey: string | null;
};

/** Quantity steps arrive in bursts; one request covers the burst. */
const REPRICE_DELAY_MS = 150;

/** Identifies a cart line: a product, in one colour. */
export const lineKey = (line: Pick<CartItem, "productId" | "variantId">) => `${line.productId}:${line.variantId ?? ""}`;

/**
 * Prices items on the server (current prices, tiers, MOQ, stock and GST) and
 * re-prices when they change. The first request goes out at once; later ones
 * wait for a pause in edits. The latest request wins; stale ones are aborted.
 * The last good pricing stays available while a new one loads.
 */
export function useCartPricing(items: CartItem[]) {
  const key = useMemo(() => JSON.stringify(items), [items]);
  const [state, setState] = useState<PricingState>({ pricing: null, pricedKey: null, error: null, settledKey: null });
  const [attempt, setAttempt] = useState(0);
  const pricedOnce = useRef(false);

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
        pricedOnce.current = true;
        setState({ pricing: payload.data, pricedKey: key, error: null, settledKey: key });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error && error.name !== "SyntaxError" ? error.message : "Prices could not be loaded.";
        setState((current) => ({ ...current, error: message, settledKey: key }));
      }
    }, pricedOnce.current ? REPRICE_DELAY_MS : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [key, attempt]);

  // The server answers one line per requested item, in order; key them by the
  // item they price (a removed colour comes back without its variant id).
  const linesByKey = useMemo(() => {
    const lines = new Map<string, PricedCartLine>();
    if (!state.pricing || !state.pricedKey) return lines;
    (JSON.parse(state.pricedKey) as CartItem[]).forEach((item, index) => {
      const line = state.pricing?.lines[index];
      if (line) lines.set(lineKey(item), line);
    });
    return lines;
  }, [state.pricing, state.pricedKey]);

  const retry = useCallback(() => {
    setState((current) => ({ ...current, error: null, settledKey: null }));
    setAttempt((value) => value + 1);
  }, []);

  const empty = items.length === 0;
  return {
    pricing: empty ? null : state.pricing,
    linesByKey,
    error: empty ? null : state.error,
    loading: !empty && state.settledKey !== key,
    /** The shown pricing is for exactly these items (no edits since). */
    current: !empty && state.pricedKey === key,
    retry,
  };
}
