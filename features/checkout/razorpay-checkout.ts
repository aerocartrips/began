type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutInput = {
  key: string;
  amount: number;
  currency: string;
  orderId: string;
  customer: { name?: string; email?: string; phone?: string };
  description?: string;
  onSuccess: (response: RazorpaySuccessResponse) => void | Promise<void>;
  onDismiss?: () => void;
};

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay Checkout."));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export async function openRazorpayCheckout(input: RazorpayCheckoutInput) {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");

  const checkout = new window.Razorpay({
    key: input.key,
    amount: input.amount,
    currency: input.currency,
    order_id: input.orderId,
    name: "Norosilk",
    description: input.description ?? "Wholesale saree order",
    prefill: {
      name: input.customer.name,
      email: input.customer.email,
      contact: input.customer.phone,
    },
    theme: { color: "#6863ed" },
    handler: (response: RazorpaySuccessResponse) => {
      void input.onSuccess(response);
    },
    modal: {
      ondismiss: () => input.onDismiss?.(),
    },
  });

  checkout.on("payment.failed", () => {
    input.onDismiss?.();
  });

  checkout.open();
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: () => void) => void;
    };
  }
}

export type { RazorpaySuccessResponse };
