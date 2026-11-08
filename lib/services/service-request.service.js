import mongoose from "mongoose";
import { z } from "zod";
import {
  SERVICE_REQUEST_STATUS,
  SERVICE_REQUEST_TYPE,
  ServiceRequest,
} from "@/lib/db/models/ServiceRequest";
import { ApiError } from "@/lib/utils/api-error";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { Order } from "@/lib/db/models/Order";
import { withTransaction } from "@/lib/db/transaction";
import { ORDER_STATUS, RETURN_REQUEST_STATUS, STATUS_CHANGE_SOURCE } from "@/lib/constants/order-status";
import { createAdminRefund } from "@/lib/services/refund.service";
import { appendOrderStatusHistory, applyFulfillmentStatus } from "@/lib/services/order-status.service";
import { onOrderStatusChanged } from "@/lib/notifications/events";
import { escapeRegex } from "@/lib/utils/escape-regex";
// Registers schemas used by populate() below.
import "@/lib/db/models/User";

const updateSchema = z.object({
  status: z.enum(Object.values(SERVICE_REQUEST_STATUS)).optional(),
  internalNotes: z.string().trim().max(4000).optional(),
  remarks: z.string().trim().max(2000).optional(),
  initiateRefund: z.boolean().optional(),
});

function pushHistory(doc, { previousStatus, newStatus, adminUser, remarks }) {
  doc.statusHistory.push({
    previousStatus,
    newStatus,
    changedBy: adminUser?._id ?? null,
    changedByLabel: adminUser?.email ?? adminUser?.name ?? "admin",
    remarks: remarks ?? "",
  });
}

export async function upsertCancellationRequest(order, user, reason) {
  const existing = await ServiceRequest.findOne({
    order: order._id,
    type: SERVICE_REQUEST_TYPE.CANCELLATION,
  });
  if (existing) return existing;

  const doc = await ServiceRequest.create({
    order: order._id,
    customer: user._id,
    type: SERVICE_REQUEST_TYPE.CANCELLATION,
    status: SERVICE_REQUEST_STATUS.REQUESTED,
    reason,
    customerRemarks: reason,
    statusHistory: [
      {
        previousStatus: "",
        newStatus: SERVICE_REQUEST_STATUS.REQUESTED,
        changedBy: user._id,
        changedByLabel: user.email ?? user.name ?? "customer",
        remarks: reason,
      },
    ],
  });
  return doc;
}

export async function upsertReturnRequest(order, user, { reason, remarks }) {
  let doc = await ServiceRequest.findOne({
    order: order._id,
    type: SERVICE_REQUEST_TYPE.RETURN,
    status: { $nin: [SERVICE_REQUEST_STATUS.COMPLETED, SERVICE_REQUEST_STATUS.REJECTED] },
  });

  if (doc) return doc;

  doc = await ServiceRequest.create({
    order: order._id,
    customer: user._id,
    type: SERVICE_REQUEST_TYPE.RETURN,
    status: SERVICE_REQUEST_STATUS.REQUESTED,
    reason,
    customerRemarks: remarks ?? "",
    statusHistory: [
      {
        previousStatus: "",
        newStatus: SERVICE_REQUEST_STATUS.REQUESTED,
        changedBy: user._id,
        changedByLabel: user.email ?? user.name ?? "customer",
        remarks: remarks ?? reason,
      },
    ],
  });
  return doc;
}

export async function listServiceRequests(searchParams) {
  const { page, limit, skip } = parsePagination(searchParams);
  const filter = {};
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();
  if (type && Object.values(SERVICE_REQUEST_TYPE).includes(type)) filter.type = type;
  if (status && Object.values(SERVICE_REQUEST_STATUS).includes(status)) filter.status = status;

  let orderIds = null;
  if (search) {
    const orders = await Order.find({
      $or: [{ orderNumber: new RegExp(escapeRegex(search), "i") }],
    })
      .select("_id")
      .limit(50);
    orderIds = orders.map((entry) => entry._id);
    filter.order = { $in: orderIds };
  }

  const [items, total] = await Promise.all([
    ServiceRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customer", "name email phone companyName")
      .populate("order", "orderNumber totalAmount paymentStatus orderStatus shipment")
      .lean(),
    ServiceRequest.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta(total, page, limit) };
}

export async function getServiceRequestSummary() {
  const statuses = Object.values(SERVICE_REQUEST_STATUS);
  const counts = await ServiceRequest.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const row of counts) map[row._id] = row.count;
  return map;
}

export async function getServiceRequestById(requestId) {
  if (!mongoose.isValidObjectId(requestId)) throw new ApiError(404, "Request not found.");
  const doc = await ServiceRequest.findById(requestId)
    .populate("customer", "name email phone companyName gstNumber")
    .populate("order");
  if (!doc) throw new ApiError(404, "Request not found.");
  return doc;
}

/**
 * What a return decision means for the order and what the customer is told.
 * `orderStatus` applies to an order still awaiting the decision (return_requested).
 */
const RETURN_DECISIONS = {
  [SERVICE_REQUEST_STATUS.APPROVED]: {
    returnStatus: RETURN_REQUEST_STATUS.APPROVED,
    orderStatus: null,
    customerVisibleRemark: "Your return request was approved. We will contact you to arrange the pickup.",
  },
  [SERVICE_REQUEST_STATUS.REJECTED]: {
    returnStatus: RETURN_REQUEST_STATUS.REJECTED,
    orderStatus: ORDER_STATUS.DELIVERED,
    customerVisibleRemark: "Your return request was declined. Contact us if you have questions.",
  },
  [SERVICE_REQUEST_STATUS.REFUND_PENDING]: {
    returnStatus: RETURN_REQUEST_STATUS.APPROVED,
    orderStatus: ORDER_STATUS.RETURNED,
    customerVisibleRemark: "Your return was accepted and your refund has been started.",
  },
  [SERVICE_REQUEST_STATUS.REFUNDED]: {
    returnStatus: RETURN_REQUEST_STATUS.APPROVED,
    orderStatus: ORDER_STATUS.RETURNED,
    customerVisibleRemark: "Your return was accepted and refunded.",
  },
  [SERVICE_REQUEST_STATUS.COMPLETED]: {
    returnStatus: RETURN_REQUEST_STATUS.APPROVED,
    orderStatus: ORDER_STATUS.RETURNED,
    customerVisibleRemark: "Your return is complete.",
  },
};

/**
 * Carries a return decision over to the order, so the customer's order page
 * shows it and the order leaves "return requested".
 * @param {Record<string, any>} doc the service request, after its status changed
 * @param {Record<string, any>} adminUser
 */
async function applyReturnDecisionToOrder(doc, adminUser) {
  const decision = RETURN_DECISIONS[doc.status];
  if (doc.type !== SERVICE_REQUEST_TYPE.RETURN || !decision) return;

  const result = await withTransaction(async (session) => {
    const order = await Order.findById(doc.order?._id ?? doc.order).session(session);
    if (!order) return null;
    const previousOrderStatus = order.orderStatus;
    const meta = {
      actor: adminUser?._id ?? null,
      actorLabel: adminUser?.email ?? adminUser?.name ?? "admin",
      source: STATUS_CHANGE_SOURCE.ADMIN,
      customerVisibleRemark: decision.customerVisibleRemark,
    };
    order.returnRequest.status = decision.returnStatus;
    if (decision.orderStatus && order.orderStatus === ORDER_STATUS.RETURN_REQUESTED) {
      applyFulfillmentStatus(order, decision.orderStatus, meta);
    } else {
      appendOrderStatusHistory(order, { changedBy: meta.actor, changedByLabel: meta.actorLabel, source: meta.source, customerVisibleRemark: meta.customerVisibleRemark });
    }
    await order.save({ session });
    return { order, previousOrderStatus };
  });
  if (result) {
    onOrderStatusChanged(result.order, result.previousOrderStatus, { source: STATUS_CHANGE_SOURCE.ADMIN });
  }
}

/**
 * @param {string} requestId
 * @param {Record<string, any>} adminUser the admin's User document
 * @param {unknown} payload
 */
export async function updateServiceRequest(requestId, adminUser, payload) {
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const doc = await getServiceRequestById(requestId);
  const previousStatus = doc.status;

  if (parsed.data.internalNotes !== undefined) {
    doc.internalNotes = parsed.data.internalNotes;
  }

  if (parsed.data.status) {
    const previous = doc.status;
    doc.status = parsed.data.status;
    pushHistory(doc, {
      previousStatus: previous,
      newStatus: parsed.data.status,
      adminUser,
      remarks: parsed.data.remarks ?? "",
    });
  }

  if (parsed.data.initiateRefund && doc.refundStatus === "none") {
    const order = doc.order;
    if (order?.paymentStatus === "paid") {
      const previous = doc.status;
      const result = await createAdminRefund(adminUser, {
        orderId: String(order._id),
        reason: parsed.data.remarks || `${doc.type} approved refund`,
      });
      doc.refundStatus = "pending";
      doc.razorpayRefundId = result.refund?.id ?? "";
      doc.status = SERVICE_REQUEST_STATUS.REFUND_PENDING;
      pushHistory(doc, {
        previousStatus: previous,
        newStatus: SERVICE_REQUEST_STATUS.REFUND_PENDING,
        adminUser,
        remarks: "Refund initiated.",
      });
    }
  }

  await doc.save();
  if (doc.status !== previousStatus) await applyReturnDecisionToOrder(doc, adminUser);
  return doc;
}

/**
 * One-time import of cancellation and return requests recorded on orders
 * before service requests existed. Run by scripts/migrate-order-lifecycle.mjs.
 */
export async function migrateLegacyServiceRequestsFromOrders() {
  const orders = await Order.find({
    $or: [
      { "returnRequest.status": { $in: ["pending", "approved", "rejected"] } },
      { orderStatus: "cancelled", "cancellation.reason": { $ne: "" } },
    ],
  }).limit(500);

  let imported = 0;
  for (const order of orders) {
    if (order.orderStatus === "cancelled" && order.cancellation?.reason) {
      const exists = await ServiceRequest.findOne({
        order: order._id,
        type: SERVICE_REQUEST_TYPE.CANCELLATION,
      });
      if (!exists) {
        await ServiceRequest.create({
          order: order._id,
          customer: order.customer,
          type: SERVICE_REQUEST_TYPE.CANCELLATION,
          status: SERVICE_REQUEST_STATUS.REQUESTED,
          reason: order.cancellation.reason,
          customerRemarks: order.cancellation.reason,
        });
        imported += 1;
      }
    }
    if (order.returnRequest?.status && order.returnRequest.status !== "none") {
      const exists = await ServiceRequest.findOne({
        order: order._id,
        type: SERVICE_REQUEST_TYPE.RETURN,
      });
      if (!exists) {
        await ServiceRequest.create({
          order: order._id,
          customer: order.customer,
          type: SERVICE_REQUEST_TYPE.RETURN,
          status: SERVICE_REQUEST_STATUS.REQUESTED,
          reason: order.returnRequest.reason,
          customerRemarks: order.returnRequest.remarks,
        });
        imported += 1;
      }
    }
  }
  return { imported };
}
