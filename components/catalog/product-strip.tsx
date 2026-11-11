"use client";

import { useEffect, useState } from "react";
import ProductRail from "@/components/catalog/product-rail";
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
    // Not aborted on cleanup (see ForYouRail); the answer for an outdated list of ids is ignored.
    let current = true;
    fetch(`/api/v1/catalog/products?ids=${key}`)
      .then((response) => response.json())
      .then((payload): ProductCardData[] => (payload.success ? payload.data : []))
      .catch((): ProductCardData[] => [])
      .then((cards) => {
        if (current) setState({ key, cards });
      });
    return () => {
      current = false;
    };
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
      <ProductRail products={cards} salesMode={salesMode} label={title} />
    </section>
  );
}
