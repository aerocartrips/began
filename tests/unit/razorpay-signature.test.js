import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyPaymentSignature, verifyWebhookSignature } from "@/lib/razorpay/signature";

describe("razorpay signatures", () => {
  it("verifies payment signatures with HMAC SHA256", () => {
    const secret = "test_secret_key";
    const orderId = "order_123";
    const paymentId = "pay_456";
    const signature = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

    expect(() =>
      verifyPaymentSignature({ orderId, paymentId, signature, secret }),
    ).not.toThrow();
  });

  it("rejects invalid payment signatures", () => {
    expect(() =>
      verifyPaymentSignature({
        orderId: "order_123",
        paymentId: "pay_456",
        signature: "invalid",
        secret: "test_secret_key",
      }),
    ).toThrow();
  });

  it("verifies webhook signatures from raw body", () => {
    const secret = "webhook_secret";
    const body = "{\"event\":\"payment.captured\"}";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(() => verifyWebhookSignature(body, signature, secret)).not.toThrow();
  });
});
