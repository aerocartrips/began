import { apiRequest } from "@/lib/api/api-client";
import type { OrderDetail, OrderListItem, OrderPaymentInfo, OrderSummaryStats } from "@/features/orders/types";

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchOrderSummary() {
  return apiRequest<OrderSummaryStats>("/api/v1/orders/summary");
}

export async function fetchCustomerOrders(params: Record<string, string | undefined>) {
  const result = await apiRequest<OrderListItem[]>(`/api/v1/orders${buildQuery(params)}`);
  return result;
}

export async function fetchOrderDetail(orderId: string) {
  return apiRequest<{ order: OrderDetail; payment: OrderPaymentInfo | null }>(
    `/api/v1/orders/${encodeURIComponent(orderId)}`,
  );
}

export async function cancelOrder(orderId: string, reason: string) {
  return apiRequest(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function requestOrderReturn(orderId: string, reason: string, remarks?: string) {
  return apiRequest(`/api/v1/orders/${encodeURIComponent(orderId)}/return-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, remarks }),
  });
}

export async function refreshOrderPayment(orderId: string) {
  return apiRequest(`/api/v1/orders/${encodeURIComponent(orderId)}/refresh-payment`, {
    method: "POST",
  });
}

export async function fetchOrderTracking(orderId: string, refresh = false) {
  const suffix = refresh ? "?refresh=1" : "";
  return apiRequest(`/api/v1/orders/${encodeURIComponent(orderId)}/tracking${suffix}`);
}
