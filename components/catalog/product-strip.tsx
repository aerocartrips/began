"use client";

import { useEffect, useState } from "react";
import ProductGrid from "@/components/catalog/product-grid";
import type { ProductCardData } from "@/features/catalog/types";

/**
 * Cards for product ids held in the browser (recently viewed, wishlist).
 * Fetches current prices and availability from the catalogue API.
 */
export function useProductCards(ids: string[]) {
  const key = ids.join(",");
  const [state, setState] = useState<{ key: string; cards: ProductCardData[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch(`/api/v1/catalog/products?ids=${key}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => setState({ key, cards: payload.success ? payload.data : [] }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, cards: [] });
      });
    return () => controller.abort();
  }, [key]);

  return { cards: key && state?.key === key ? state.cards : [], loading: Boolean(key) && state?.key !== key };
}

export default function ProductStrip({ ids, title, salesMode }: {
  ids: string[];
  title: string;
  salesMode: "wholesale" | "retail";
}) {
  const { cards } = useProductCards(ids);
  if (cards.length === 0) return null;
  return (
    <section className="product-strip" aria-label={title}>
      <h2>{title}</h2>
      <ProductGrid products={cards} salesMode={salesMode} label={title} />
    </section>
  );
}
