import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/utils/api-error";
import { calculateOrderTotals, generateOrderNumber, resolveUnitPrice } from "@/lib/services/order-pricing";
import { basePriceFor, compareAtPriceFor, minimumQuantityFor, priceTiersFor } from "@/lib/catalog/pricing";

const product = {
  name: "Aurora Silk",
  price: 5000,
  compareAtPrice: 6000,
  wholesalePrice: 4200,
  minimumOrderQuantity: 10,
  bulkPricingTiers: [
    { minQuantity: 100, pricePerUnit: 3600 },
    { minQuantity: 50, pricePerUnit: 3900 },
  ],
};

describe("wholesale pricing", () => {
  it("enforces the minimum order quantity", () => {
    expect(() => resolveUnitPrice(product, 5, "wholesale")).toThrow(ApiError);
    expect(minimumQuantityFor(product, "wholesale")).toBe(10);
  });

  it("uses the wholesale price at the MOQ and the best tier above it", () => {
    expect(resolveUnitPrice(product, 10, "wholesale")).toBe(4200);
    expect(resolveUnitPrice(product, 75, "wholesale")).toBe(3900);
    expect(resolveUnitPrice(product, 100, "wholesale")).toBe(3600);
  });

  it("lists tiers in ascending order and hides retail strike-through prices", () => {
    expect(priceTiersFor(product, "wholesale").map((tier) => tier.minQuantity)).toEqual([50, 100]);
    expect(compareAtPriceFor(product, "wholesale")).toBeNull();
  });
});

describe("retail pricing", () => {
  it("sells single pieces at the retail price, ignoring MOQ and tiers", () => {
    expect(minimumQuantityFor(product, "retail")).toBe(1);
    expect(resolveUnitPrice(product, 1, "retail")).toBe(5000);
    expect(resolveUnitPrice(product, 500, "retail")).toBe(5000);
    expect(priceTiersFor(product, "retail")).toEqual([]);
    expect(basePriceFor(product, "retail")).toBe(5000);
    expect(compareAtPriceFor(product, "retail")).toBe(6000);
  });
});

describe("order totals", () => {
  it("adds GST per line, falling back to the store default, and on shipping", () => {
    const totals = calculateOrderTotals(
      [
        { lineTotal: 1000, gstRatePercent: 5 },
        { lineTotal: 2000, gstRatePercent: null },
      ],
      { defaultGstRatePercent: 12, shippingFlatAmount: 100 },
    );
    expect(totals.subtotal).toBe(3000);
    expect(totals.shippingCharges).toBe(100);
    expect(totals.tax).toBe(50 + 240 + 12);
    expect(totals.totalAmount).toBe(3000 + 100 + 302);
  });

  it("waives shipping at the free-shipping threshold", () => {
    const totals = calculateOrderTotals([{ lineTotal: 5000 }], { shippingFlatAmount: 150, shippingFreeThreshold: 5000 });
    expect(totals.shippingCharges).toBe(0);
  });

  it("prefixes order numbers with the store", () => {
    expect(generateOrderNumber("aurum-silks")).toMatch(/^AUR-\d{8}-[A-Z0-9]{6}$/);
  });
});
