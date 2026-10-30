import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/utils/api-error";
import {
  calculateOrderTotals,
  calculateTax,
  resolveUnitPrice,
} from "@/lib/services/order-pricing";

describe("order pricing", () => {
  const product = {
    name: "Aurora Silk",
    price: 5000,
    wholesalePrice: 4200,
    minimumOrderQuantity: 10,
    bulkPricingTiers: [
      { minQuantity: 50, pricePerUnit: 3900 },
      { minQuantity: 100, pricePerUnit: 3600 },
    ],
  };

  it("enforces MOQ", () => {
    expect(() => resolveUnitPrice(product, 5)).toThrow(ApiError);
  });

  it("uses wholesale price above MOQ", () => {
    expect(resolveUnitPrice(product, 10)).toBe(4200);
  });

  it("applies bulk tier pricing", () => {
    expect(resolveUnitPrice(product, 100)).toBe(3600);
  });

  it("calculates tax from env rate", () => {
    process.env.TAX_RATE_PERCENT = "5";
    expect(calculateTax(1000)).toBe(50);
    delete process.env.TAX_RATE_PERCENT;
  });

  it("calculates order totals", () => {
    process.env.SHIPPING_FLAT_AMOUNT = "100";
    const totals = calculateOrderTotals([{ lineTotal: 42000 }, { lineTotal: 8000 }]);
    expect(totals.subtotal).toBe(50000);
    expect(totals.shippingCharges).toBe(100);
    delete process.env.SHIPPING_FLAT_AMOUNT;
  });
});
