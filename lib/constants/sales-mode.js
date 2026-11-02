/**
 * How a store sells. Configured per tenant (Tenant.salesMode).
 * - wholesale: minimum order quantities, quantity tiers, wholesale price, quote requests.
 * - retail: single-piece purchases at the retail price.
 */
export const SALES_MODE = {
  WHOLESALE: "wholesale",
  RETAIL: "retail",
};

export const SALES_MODE_VALUES = Object.values(SALES_MODE);
