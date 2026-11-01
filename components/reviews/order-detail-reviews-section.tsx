"use client";

import { useEffect, useState } from "react";
import OrderProductReviewAction from "@/components/reviews/order-product-review-action";
import { fetchOrderReviewContext } from "@/features/reviews/review-api";
import type { OrderReviewContextMap } from "@/features/reviews/types";

type OrderDetailReviewsSectionProps = {
  orderId: string;
  orderStatus: string;
};

export default function OrderDetailReviewsSection({ orderId, orderStatus }: OrderDetailReviewsSectionProps) {
  const [context, setContext] = useState<OrderReviewContextMap[string] | null>(null);

  useEffect(() => {
    if (orderStatus !== "delivered") return;
    let cancelled = false;
    void fetchOrderReviewContext([orderId]).then((result) => {
      if (!cancelled) setContext(result.data?.[orderId] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, orderStatus]);

  if (orderStatus !== "delivered" || !context) return null;

  return (
    <section className="account-panel">
      <h2>Review your products</h2>
      <p className="account-muted">Share verified purchase feedback for each delivered product.</p>
      <div className="orders-card-reviews">
        {Object.values(context).map((item) => (
          <OrderProductReviewAction
            key={item.productId}
            orderId={orderId}
            context={item}
            onUpdated={() => {
              void fetchOrderReviewContext([orderId]).then((result) => {
                setContext(result.data?.[orderId] ?? null);
              });
            }}
          />
        ))}
      </div>
    </section>
  );
}
