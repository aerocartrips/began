"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOrderPaymentStatus } from "@/features/checkout/order-payment-status";

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 15;

type PaymentStatusPollOptions = {
  orderId: string | null;
  enabled: boolean;
  onPaid: (orderNumber: string) => void;
  onFailed?: () => void;
};

export function usePaymentStatusPoll({
  orderId,
  enabled,
  onPaid,
  onFailed,
}: PaymentStatusPollOptions) {
  const [refreshing, setRefreshing] = useState(false);
  const onPaidRef = useRef(onPaid);
  const onFailedRef = useRef(onFailed);
  const stoppedRef = useRef(false);

  useEffect(() => {
    onPaidRef.current = onPaid;
    onFailedRef.current = onFailed;
  }, [onFailed, onPaid]);

  const checkStatus = useCallback(async () => {
    if (!orderId || stoppedRef.current) return;

    setRefreshing(true);
    try {
      const result = await fetchOrderPaymentStatus(orderId);
      const snapshot = result.data;
      if (!snapshot) return;

      if (snapshot.paymentStatus === "paid") {
        stoppedRef.current = true;
        onPaidRef.current(snapshot.orderNumber);
        return;
      }

      if (snapshot.paymentStatus === "failed") {
        stoppedRef.current = true;
        onFailedRef.current?.();
      }
    } catch {
      // Ignore transient failures; polling or manual refresh can retry.
    } finally {
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    stoppedRef.current = false;
    if (!enabled || !orderId) return undefined;

    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stoppedRef.current || attempts >= MAX_POLL_ATTEMPTS) return;
      attempts += 1;
      await checkStatus();
      if (!stoppedRef.current && attempts < MAX_POLL_ATTEMPTS) {
        timeoutId = setTimeout(() => {
          void tick();
        }, POLL_INTERVAL_MS);
      }
    };

    void tick();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [checkStatus, enabled, orderId]);

  return { refresh: checkStatus, refreshing };
}
