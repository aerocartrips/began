import { describe, expect, it } from "vitest";
import { canCustomerCancel } from "@/lib/constants/order-transitions";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";
import { buildInvoiceNumber } from "@/lib/invoices/invoice-number";

describe("storefront account helpers", () => {
  it("allows cancel for paid confirmed orders before shipment", () => {
    expect(canCustomerCancel(ORDER_STATUS.CONFIRMED, PAYMENT_STATUS.PAID)).toBe(true);
  });

  it("blocks cancel after shipment", () => {
    expect(canCustomerCancel(ORDER_STATUS.SHIPPED, PAYMENT_STATUS.PAID)).toBe(false);
  });
});

describe("invoice numbers", () => {
  it("derives stable invoice numbers from order numbers", () => {
    expect(buildInvoiceNumber({ orderNumber: "NS-1001", invoice: null })).toBe("INV-NS-1001");
    expect(buildInvoiceNumber({ orderNumber: "NS-1001", invoice: { number: "INV-CUSTOM" } })).toBe(
      "INV-CUSTOM",
    );
  });
});
