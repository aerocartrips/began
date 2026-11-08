import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";

/**
 * One definition of a sale for every revenue figure (dashboard, customer
 * list, customer profile): the order is paid, possibly partly refunded, and not
 * cancelled. Unpaid, abandoned, cancelled and fully refunded orders never count.
 * Amounts are what the store keeps: the order total minus refunds (rupees).
 */
const REVENUE_PAYMENT_STATUSES = [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED];

/** Aggregation expression: whether the current order is a sale. */
export const isSaleExpression = {
  $and: [
    { $in: ["$paymentStatus", REVENUE_PAYMENT_STATUSES] },
    { $ne: ["$orderStatus", ORDER_STATUS.CANCELLED] },
  ],
};

/** Aggregation expression: net revenue of the current order. */
export const netRevenueExpression = { $subtract: ["$totalAmount", { $ifNull: ["$amountRefunded", 0] }] };

/** `$group` accumulators: number of sales and their net revenue. */
export const salesAccumulators = {
  sales: { $sum: { $cond: [isSaleExpression, 1, 0] } },
  revenue: { $sum: { $cond: [isSaleExpression, netRevenueExpression, 0] } },
};

/**
 * Average order value over sales only.
 * @param {number} revenue
 * @param {number} sales
 */
export function averageOrderValue(revenue, sales) {
  return sales > 0 ? Math.round((revenue / sales) * 100) / 100 : 0;
}
