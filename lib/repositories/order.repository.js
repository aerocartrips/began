import mongoose from "mongoose";
import { Order } from "@/lib/db/models/Order";
import { escapeRegex } from "@/lib/utils/escape-regex";
// Registers schemas used by populate() below.
import "@/lib/db/models/User";

function buildListFilter({
  customerId,
  orderStatus,
  paymentStatus,
  q,
  dateFrom,
  dateTo,
}) {
  const filter = {};
  if (customerId) filter.customer = customerId;
  if (orderStatus) filter.orderStatus = orderStatus;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  if (q?.trim()) {
    const term = q.trim();
    filter.$or = [
      { orderNumber: new RegExp(escapeRegex(term), "i") },
      { "items.productName": new RegExp(escapeRegex(term), "i") },
    ];
  }

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  return filter;
}

export const orderRepository = {
  findById(orderId) {
    if (!mongoose.isValidObjectId(orderId)) return null;
    return Order.findById(orderId).populate("customer", "name email companyName phone");
  },

  findByOrderNumber(orderNumber) {
    return Order.findOne({ orderNumber: orderNumber.toUpperCase() }).populate(
      "customer",
      "name email companyName phone",
    );
  },

  async listFiltered({
    customerId,
    skip,
    limit,
    orderStatus,
    paymentStatus,
    q,
    dateFrom,
    dateTo,
    sort = "desc",
  }) {
    const filter = buildListFilter({
      customerId,
      orderStatus,
      paymentStatus,
      q,
      dateFrom,
      dateTo,
    });
    const sortDir = sort === "asc" ? 1 : -1;
    const query = Order.find(filter).sort({ createdAt: sortDir, _id: sortDir }).skip(skip).limit(limit);
    if (!customerId) {
      query.populate("customer", "name email companyName");
    }
    const [items, total] = await Promise.all([query, Order.countDocuments(filter)]);
    return { items, total };
  },

  async aggregateSummary(customerId) {
    const match = customerId ? { customer: new mongoose.Types.ObjectId(String(customerId)) } : {};
    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pendingPayment: {
            $sum: {
              $cond: [{ $in: ["$orderStatus", ["pending_payment", "pending"]] }, 1, 0],
            },
          },
          processing: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "processing"] }, 1, 0] },
          },
          shipped: {
            $sum: {
              $cond: [
                { $in: ["$orderStatus", ["shipped", "out_for_delivery"]] },
                1,
                0,
              ],
            },
          },
          delivered: { $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] } },
        },
      },
    ]);

    const summary = rows[0] ?? {
      total: 0,
      pendingPayment: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      paid: 0,
      cancelled: 0,
    };
    delete summary._id;
    return summary;
  },

  create(data, session) {
    return Order.create([data], { session }).then((docs) => docs[0]);
  },
};
