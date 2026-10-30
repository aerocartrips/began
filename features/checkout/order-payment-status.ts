import { apiRequest } from "@/lib/api/api-client";

export type OrderPaymentSnapshot = {
  _id: string;
  orderNumber: string;
  paymentStatus: string;
  orderStatus: string;
  totalAmount?: number;
  currency?: string;
};

export async function fetchOrderPaymentStatus(orderId: string) {
  const result = await apiRequest<{ order: OrderPaymentSnapshot; payment: unknown }>(
    `/api/v1/orders/${encodeURIComponent(orderId)}`,
  );
  return {
    ...result,
    data: result.data?.order ?? null,
  };
}
