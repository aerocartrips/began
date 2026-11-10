import { describe, expect, it } from "vitest";
import { cartRows, gstLabel, lineProblem, lineProblemText, problemFix, unitLabel } from "@/features/cart/cart-rows";
import { priceForQuantity, unitPriceFor } from "@/lib/catalog/pricing";
import { toCustomerOrder } from "@/lib/services/order-dto";

const TIERS = [
  { minQuantity: 25, pricePerUnit: 3069 },
  { minQuantity: 100, pricePerUnit: 2907 },
];

/** A line as the pricing API returns it, priced for `quantity`. */
function pricedLine(quantity, overrides = {}) {
  const unitPrice = priceForQuantity(3230, TIERS, quantity);
  return {
    productId: "6aea730b5d285a0f14a01cb0",
    variantId: "6aea730b5d285a0f14a01cb3",
    quantity,
    name: "Jamdani saree",
    minimumQuantity: 5,
    available: 206,
    basePrice: 3230,
    compareAtPrice: null,
    unitPrice,
    lineTotal: unitPrice * quantity,
    tiers: TIERS,
    issues: [],
    ...overrides,
  };
}

const keyOf = (line) => `${line.productId}:${line.variantId ?? ""}`;
const rowsFor = (quantity, line) => cartRows([{ productId: line.productId, variantId: line.variantId, quantity }], new Map([[keyOf(line), line]]));

describe("quantity pricing", () => {
  it("uses the last tier the quantity reaches, as orders do", () => {
    expect(priceForQuantity(3230, TIERS, 24)).toBe(3230);
    expect(priceForQuantity(3230, TIERS, 25)).toBe(3069);
    expect(priceForQuantity(3230, TIERS, 400)).toBe(2907);
    const product = { price: 4000, wholesalePrice: 3230, bulkPricingTiers: TIERS };
    expect(unitPriceFor(product, 30, "wholesale")).toBe(3069);
    expect(unitPriceFor(product, 30, "retail")).toBe(4000);
  });
});

describe("cart rows", () => {
  it("reprices a changed quantity at once with the server's rule, and offers the next tier", () => {
    const [row] = rowsFor(30, pricedLine(5));
    expect(row.repricing).toBe(true);
    expect(row.unitPrice).toBe(3069);
    expect(row.lineTotal).toBe(92070);
    expect(row.saving).toBe((3230 - 3069) * 30);
    expect(row.nextTier).toEqual({ minQuantity: 100, pricePerUnit: 2907 });
  });

  it("only offers tiers the stock can fill", () => {
    const [row] = rowsFor(30, pricedLine(30, { available: 80 }));
    expect(row.nextTier).toBeNull();
  });

  it("uses the server's figures when the quantity is the one it priced", () => {
    const [row] = rowsFor(5, pricedLine(5, { unitPrice: 3100, lineTotal: 15500 }));
    expect(row.repricing).toBe(false);
    expect(row.lineTotal).toBe(15500);
  });

  it("waits for pricing before showing a line", () => {
    const [row] = cartRows([{ productId: "6aea730b5d285a0f14a01cb0", variantId: null, quantity: 2 }], new Map());
    expect(row.line).toBeNull();
    expect(row.problem).toBeNull();
  });
});

describe("line problems", () => {
  it("finds the problem and the quantity that fixes it", () => {
    const below = lineProblem(pricedLine(2), 2);
    expect(below).toEqual({ kind: "minimum", minimum: 5 });
    expect(problemFix(below)).toBe(5);

    const over = lineProblem(pricedLine(300), 300);
    expect(over).toEqual({ kind: "stock", available: 206 });
    expect(problemFix(over)).toBe(206);

    expect(lineProblem(pricedLine(10), 10)).toBeNull();
  });

  it("can't be fixed in place when stock is below the minimum order", () => {
    const soldOut = lineProblem(pricedLine(20, { available: 0 }), 20);
    expect(soldOut).toEqual({ kind: "soldOut", available: 0, minimum: 5 });
    expect(problemFix(soldOut)).toBeNull();
    expect(lineProblemText(soldOut, "pieces")).toBe("Out of stock.");
    expect(lineProblemText({ kind: "soldOut", available: 3, minimum: 5 }, "pieces")).toBe("Only 3 left, below the minimum order of 5 pieces.");
  });

  it("reports withdrawn products and colours first", () => {
    expect(lineProblem({ productId: "x", variantId: null, quantity: 1, unavailable: true }, 1)).toEqual({ kind: "unavailable" });
    expect(lineProblem(pricedLine(5, { issues: [{ field: "variantId", message: "Choose a colour." }] }), 5)).toEqual({ kind: "colour" });
  });
});

describe("labels", () => {
  it("names the GST rates and the unit", () => {
    expect(gstLabel([5])).toBe("GST (5%)");
    expect(gstLabel([5, 12])).toBe("GST (5%, 12%)");
    expect(gstLabel([])).toBe("GST");
    expect(unitLabel("wholesale", 1)).toBe("piece");
    expect(unitLabel("retail", 3)).toBe("items");
  });
});

describe("customer order view", () => {
  it("includes the shopper's checkout note and whether the order still awaits payment", () => {
    const order = toCustomerOrder(
      {
        _id: "o1",
        orderNumber: "NOR-20261109-ABC123",
        orderStatus: "pending_payment",
        paymentStatus: "pending",
        createdAt: new Date(),
        paymentExpiresAt: new Date(Date.now() + 20 * 60 * 1000),
        items: [],
        notes: "PO 4471, deliver after 10am",
        internalNotes: "staff only",
      },
      { cancellationWindowHours: 48, returnWindowDays: 7 },
    );
    expect(order.notes).toBe("PO 4471, deliver after 10am");
    expect(order).not.toHaveProperty("internalNotes");
    expect(order.actions.awaitingPayment).toBe(true);
  });
});
