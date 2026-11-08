import { describe, expect, it } from "vitest";
import { canCustomerCancel } from "@/lib/constants/order-transitions";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";
import { financialYearLabel, formatInvoiceNumber } from "@/lib/invoices/invoice-number";

describe("storefront account helpers", () => {
  it("allows cancel for paid confirmed orders before shipment", () => {
    expect(canCustomerCancel(ORDER_STATUS.CONFIRMED, PAYMENT_STATUS.PAID)).toBe(true);
  });

  it("blocks cancel after shipment", () => {
    expect(canCustomerCancel(ORDER_STATUS.SHIPPED, PAYMENT_STATUS.PAID)).toBe(false);
  });
});

describe("invoice numbers", () => {
  it("uses the Indian financial year in IST (April to March)", () => {
    expect(financialYearLabel(new Date("2026-03-31T18:29:59Z"))).toBe("25-26"); // 23:59 IST on 31 March
    expect(financialYearLabel(new Date("2026-03-31T18:30:00Z"))).toBe("26-27"); // 00:00 IST on 1 April
    expect(financialYearLabel(new Date("2026-11-07T10:00:00Z"))).toBe("26-27");
  });

  it("formats consecutive serials within GST's 16-character limit", () => {
    expect(formatInvoiceNumber({ prefix: "INV", financialYear: "26-27", sequence: 42 })).toBe("INV/26-27/00042");
    expect(formatInvoiceNumber({ prefix: "norosilk-shop", financialYear: "26-27", sequence: 7 })).toBe("NORO/26-27/00007");
    for (const prefix of ["", "INV", "ABCD", "a long prefix"]) {
      expect(formatInvoiceNumber({ prefix, financialYear: "26-27", sequence: 123456 }).length).toBeLessThanOrEqual(16);
    }
  });
});
