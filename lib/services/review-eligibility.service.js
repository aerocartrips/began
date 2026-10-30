import mongoose from "mongoose";
import { ORDER_STATUS } from "@/lib/constants/order-status";
import { Order } from "@/lib/db/models/Order";
import { ApiError } from "@/lib/utils/api-error";

/**
 * @param {string} orderId
 * @param {string} userId
 * @param {string} productId
 */
export async function assertDeliveredPurchaseEligibility(orderId, userId, productId) {
  if (
    !mongoose.isValidObjectId(orderId) ||
    !mongoose.isValidObjectId(productId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw new ApiError(400, "Invalid review reference.");
  }

  const order = await Order.findById(orderId).select("customer orderStatus items.product").lean();
  if (!order) {
    throw new ApiError(404, "Order not found.");
  }
  if (String(order.customer) !== String(userId)) {
    throw new ApiError(403, "You do not have access to this order.");
  }
  if (order.orderStatus !== ORDER_STATUS.DELIVERED) {
    throw new ApiError(409, "Reviews are only available after delivery is complete.");
  }

  const inOrder = order.items.some((item) => String(item.product) === String(productId));
  if (!inOrder) {
    throw new ApiError(403, "This product was not part of the selected order.");
  }

  return order;
}

/**
 * @param {string} userId
 * @param {string[]} orderIds
 */
export async function loadDeliveredOrderProductIds(userId, orderIds) {
  const validIds = orderIds.filter((id) => mongoose.isValidObjectId(id));
  if (!validIds.length) return [];

  const orders = await Order.find({
    _id: { $in: validIds },
    customer: userId,
    orderStatus: ORDER_STATUS.DELIVERED,
  })
    .select("_id items.product items.productName items.quantity items.imageUrl items.sku")
    .lean();

  return orders;
}
