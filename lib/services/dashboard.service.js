import { Order } from "@/lib/db/models/Order";
import { Payment } from "@/lib/db/models/Payment";
import { Product } from "@/lib/db/models/Product";
import { SupportConversation, SUPPORT_CONVERSATION_STATUS } from "@/lib/db/models/SupportConversation";
import { PAYMENT_RECORD_STATUS } from "@/lib/constants/payment-status";
import { salesAccumulators } from "@/lib/services/revenue";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";

import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";


/**
 * Headline figures for the admin overview. Order totals are stored in rupees.
 */
export async function getAdminDashboardStats() {
  const { commerce } = await getStoreSettingsDocument();
  const lowStockThreshold = commerce.lowStockThreshold;
  const [activeProducts, totalProducts, orderTotals, failedPayments, openConversations, lowStock] =
    await Promise.all([
      Product.countDocuments({ status: PRODUCT_STATUS.ACTIVE }),
      Product.countDocuments({}),
      Order.aggregate([{ $group: { _id: null, orders: { $sum: 1 }, ...salesAccumulators } }]),
      Payment.countDocuments({ status: PAYMENT_RECORD_STATUS.FAILED }),
      SupportConversation.countDocuments({
        status: { $nin: [SUPPORT_CONVERSATION_STATUS.RESOLVED, SUPPORT_CONVERSATION_STATUS.CLOSED] },
      }),
      Product.countDocuments({
        status: PRODUCT_STATUS.ACTIVE,
        stockQuantity: { $lte: lowStockThreshold },
      }),
    ]);

  return {
    activeProducts,
    totalProducts,
    orders: orderTotals[0]?.orders ?? 0,
    paidOrders: orderTotals[0]?.sales ?? 0,
    // Net of refunds; cancelled and unpaid orders excluded (lib/services/revenue.js).
    paidRevenue: orderTotals[0]?.revenue ?? 0,
    failedPayments,
    openConversations,
    lowStock,
    lowStockThreshold,
  };
}
