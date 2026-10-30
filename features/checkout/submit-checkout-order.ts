import type { CartLine } from "@/features/cart/types/cart";
import type { RazorpaySuccessResponse } from "@/features/checkout/razorpay-checkout";

type CheckoutAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  errors?: { field: string; message: string }[];
};

type CreatePaymentOrderData = {
  key: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  internalOrderId: string;
  orderNumber: string;
};

function mapSelectedAttributes(item: CartLine) {
  const attributes: Record<string, string> = {};
  for (const [optionId, valueId] of Object.entries(item.selectedOptions)) {
    const option = item.product.options.find((candidate) => candidate.id === optionId);
    const value = option?.values.find((candidate) => candidate.id === valueId);
    if (option && value) attributes[option.label] = value.label;
  }
  return attributes;
}

function buildOrderPayload(items: CartLine[], address: CheckoutAddress) {
  return {
    items: items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      selectedAttributes: mapSelectedAttributes(item),
    })),
    shippingAddress: address,
    billingAddress: address,
    paymentMethod: "razorpay",
  };
}

export async function fetchCurrentCustomer() {
  const response = await fetch("/api/v1/auth/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as ApiEnvelope<{ email: string; name: string; phone?: string }>;
  return payload.success ? payload.data : null;
}

export async function createPaymentOrder(items: CartLine[], address: CheckoutAddress) {
  const response = await fetch("/api/v1/payments/create-order", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildOrderPayload(items, address)),
  });
  const payload = (await response.json()) as ApiEnvelope<CreatePaymentOrderData>;
  return { response, payload };
}

export async function verifyPayment(response: RazorpaySuccessResponse) {
  const result = await fetch("/api/v1/payments/verify", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
    }),
  });
  const payload = (await result.json()) as ApiEnvelope<{
    order?: { orderNumber?: string; _id?: string };
    idempotent?: boolean;
  }>;
  return { response: result, payload };
}

export type { CheckoutAddress, CreatePaymentOrderData };
