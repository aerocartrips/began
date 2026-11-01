import mongoose from "mongoose";
import { User } from "@/lib/db/models/User";
import { Order } from "@/lib/db/models/Order";
import { ROLES } from "@/lib/constants/roles";
import { escapeRegex } from "@/lib/utils/escape-regex";

function buildCustomerFilter(query) {
  /** @type {Record<string, unknown>} */
  const filter = { role: ROLES.CUSTOMER };

  if (query.activeOnly === "true") filter.isActive = true;
  if (query.activeOnly === "false") filter.isActive = false;

  const search = query.search?.trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }, { companyName: regex }];
  }

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  return filter;
}

export const userRepository = {
  findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() }).select("+password");
  },

  findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return User.findById(id).select("-password");
  },

  create(data) {
    return User.create(data);
  },

  async listCustomers({ skip, limit, searchParams }) {
    const query = Object.fromEntries(searchParams.entries());
    const filter = buildCustomerFilter(query);
    const sortField = query.sortBy === "name" ? "name" : "createdAt";
    const sortDir = query.sortOrder === "asc" ? 1 : -1;

    let customerIdsWithOrders = null;
    if (query.hasOrders === "true" || query.hasOrders === "false") {
      const ids = await Order.distinct("customer");
      customerIdsWithOrders = ids.map(String);
      if (query.hasOrders === "true") {
        filter._id = { $in: ids };
      } else {
        filter._id = { $nin: ids };
      }
    }

    const [items, total] = await Promise.all([
      User.find(filter).sort({ [sortField]: sortDir }).skip(skip).limit(limit).select("-password").lean(),
      User.countDocuments(filter),
    ]);

    const customerIds = items.map((item) => item._id);
    const stats = await Order.aggregate([
      { $match: { customer: { $in: customerIds } } },
      {
        $group: {
          _id: "$customer",
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          lastOrderAt: { $max: "$createdAt" },
        },
      },
    ]);
    const statsMap = new Map(stats.map((row) => [String(row._id), row]));

    return {
      items: items.map((customer) => {
        const row = statsMap.get(String(customer._id));
        return {
          ...customer,
          totalOrders: row?.totalOrders ?? 0,
          totalRevenue: row?.totalRevenue ?? 0,
          lastOrderAt: row?.lastOrderAt ?? null,
        };
      }),
      total,
      customerIdsWithOrders,
    };
  },

  async aggregateCustomerSummary() {
    const [totals, withOrders, revenueRows, recent] = await Promise.all([
      User.countDocuments({ role: ROLES.CUSTOMER }),
      Order.distinct("customer").then((ids) => ids.length),
      Order.aggregate([{ $group: { _id: null, revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 } } }]),
      User.countDocuments({
        role: ROLES.CUSTOMER,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    return {
      totalCustomers: totals,
      activeCustomers: await User.countDocuments({ role: ROLES.CUSTOMER, isActive: true }),
      newCustomers30d: recent,
      customersWithOrders: withOrders,
      totalOrders: revenueRows[0]?.orders ?? 0,
      totalRevenue: revenueRows[0]?.revenue ?? 0,
    };
  },

  async getCustomerOverview(customerId) {
    const orders = await Order.find({ customer: customerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("_id orderNumber createdAt totalAmount paymentStatus orderStatus items.quantity items.productName")
      .lean();

    const stats = await Order.aggregate([
      { $match: { customer: new mongoose.Types.ObjectId(String(customerId)) } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          totalQuantity: { $sum: { $sum: "$items.quantity" } },
        },
      },
    ]);

    const summary = stats[0] ?? { totalOrders: 0, totalRevenue: 0, totalQuantity: 0 };
    return {
      orders,
      totalOrders: summary.totalOrders,
      totalRevenue: summary.totalRevenue,
      totalQuantity: summary.totalQuantity,
      averageOrderValue: summary.totalOrders ? summary.totalRevenue / summary.totalOrders : 0,
    };
  },
};
