import { Order } from "@/lib/db/models/Order";
import { Payment } from "@/lib/db/models/Payment";
import { Product } from "@/lib/db/models/Product";
import { SupportConversation, SUPPORT_CONVERSATION_STATUS } from "@/lib/db/models/SupportConversation";
import { PAYMENT_STATUS } from "@/lib/constants/order-status";
import { PAYMENT_RECORD_STATUS } from "@/lib/constants/payment-status";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";

import { LOW_STOCK_THRESHOLD } from "@/lib/constants/notifications";

export { LOW_STOCK_THRESHOLD };

/**
 * Headline figures for the admin overview. Order totals are stored in rupees.
 */
export async function getAdminDashboardStats() {
  const [activeProducts, totalProducts, orderTotals, failedPayments, openConversations, lowStock] =
    await Promise.all([
      Product.countDocuments({ status: PRODUCT_STATUS.ACTIVE }),
      Product.countDocuments({}),
      Order.aggregate([
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            paidRevenue: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$totalAmount", 0] },
            },
          },
        },
      ]),
      Payment.countDocuments({ status: PAYMENT_RECORD_STATUS.FAILED }),
      SupportConversation.countDocuments({
        status: { $nin: [SUPPORT_CONVERSATION_STATUS.RESOLVED, SUPPORT_CONVERSATION_STATUS.CLOSED] },
      }),
      Product.countDocuments({
        status: PRODUCT_STATUS.ACTIVE,
        stockQuantity: { $lte: LOW_STOCK_THRESHOLD },
      }),
    ]);

  return {
    activeProducts,
    totalProducts,
    orders: orderTotals[0]?.orders ?? 0,
    paidRevenue: orderTotals[0]?.paidRevenue ?? 0,
    failedPayments,
    openConversations,
    lowStock,
  };
}
