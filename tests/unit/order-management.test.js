import { describe, expect, it } from "vitest";
import {
  assertFulfillmentTransition,
  canCustomerCancel,
  canCustomerRequestReturn,
} from "@/lib/constants/order-transitions";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";

describe("order transitions", () => {
  it("blocks shipping before payment is captured", () => {
    expect(() =>
      assertFulfillmentTransition(
        ORDER_STATUS.PACKED,
        ORDER_STATUS.SHIPPED,
        PAYMENT_STATUS.PENDING,
      ),
    ).toThrow(/payment/i);
  });

  it("allows confirmed to processing when paid", () => {
    expect(() =>
      assertFulfillmentTransition(
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.PROCESSING,
        PAYMENT_STATUS.PAID,
      ),
    ).not.toThrow();
  });

  it("blocks invalid backward transitions", () => {
    expect(() =>
      assertFulfillmentTransition(
        ORDER_STATUS.DELIVERED,
        ORDER_STATUS.PROCESSING,
        PAYMENT_STATUS.PAID,
      ),
    ).toThrow(/Invalid status transition/);
  });
});

describe("customer order actions", () => {
  it("allows cancel for pending payment", () => {
    expect(canCustomerCancel(ORDER_STATUS.PENDING_PAYMENT, PAYMENT_STATUS.PENDING)).toBe(true);
  });

  it("blocks cancel for shipped orders", () => {
    expect(canCustomerCancel(ORDER_STATUS.SHIPPED, PAYMENT_STATUS.PAID)).toBe(false);
  });

  it("allows return request only for delivered orders", () => {
    expect(canCustomerRequestReturn(ORDER_STATUS.DELIVERED)).toBe(true);
    expect(canCustomerRequestReturn(ORDER_STATUS.SHIPPED)).toBe(false);
  });
});
