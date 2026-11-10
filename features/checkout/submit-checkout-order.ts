import { fetchWithSession } from "@/lib/api/api-client";
import type { CartItem } from "@/features/cart/types";
import type { RazorpaySuccessResponse } from "@/features/checkout/razorpay-checkout";

type CheckoutAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  gstin?: string;
};

/** A saved address (resolved server-side against the customer's address book) or a one-off address. */
type AddressSelection = { addressId: string } | { address: CheckoutAddress };

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

function addressFields(kind: "shipping" | "billing", selection: AddressSelection) {
  return "addressId" in selection
    ? { [`${kind}AddressId`]: selection.addressId }
    : { [`${kind}Address`]: selection.address };
}

type OrderDetails = {
  shipping: AddressSelection;
  /** Omitted when it matches shipping; the server then bills the shipping address. */
  billing: AddressSelection | null;
  /** The shopper's note for the store (PO number, delivery instructions); "" for none. */
  notes: string;
};

function buildOrderPayload(items: CartItem[], { shipping, billing, notes }: OrderDetails) {
  return {
    // Identifiers only: the server prices every line again from the catalogue.
    items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
    ...addressFields("shipping", shipping),
    ...(billing ? addressFields("billing", billing) : {}),
    ...(notes ? { notes } : {}),
    paymentMethod: "razorpay",
  };
}

export async function createPaymentOrder(items: CartItem[], details: OrderDetails) {
  const response = await fetchWithSession("/api/v1/payments/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildOrderPayload(items, details)),
  });
  const payload = (await response.json()) as ApiEnvelope<CreatePaymentOrderData>;
  return { response, payload };
}

export async function verifyPayment(response: RazorpaySuccessResponse) {
  // The shopper may spend longer than an access token lives inside Razorpay; this survives it.
  const result = await fetchWithSession("/api/v1/payments/verify", {
    method: "POST",
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

export type { AddressSelection, CheckoutAddress, CreatePaymentOrderData, OrderDetails };
