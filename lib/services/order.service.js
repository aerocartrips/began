import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";
import { PAYMENT_RESERVATION_MINUTES } from "@/lib/constants/payment-status";
import { Product } from "@/lib/db/models/Product";
import { orderRepository } from "@/lib/repositories/order.repository";
import { createOrderSchema } from "@/lib/validators/order.validator";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import {
  calculateOrderTotals,
  generateOrderNumber,
  resolveUnitPrice,
  rupeesToPaise,
} from "@/lib/services/order-pricing";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";
import { CHECKOUT_CURRENCY } from "@/lib/constants/payment-status";
import { listOrdersQuery, getOrderSummary } from "@/lib/services/order-query.service";
import {
  applyFulfillmentStatus,
  applyPaymentStatus,
  appendOrderStatusHistory,
} from "@/lib/services/order-status.service";
import { STATUS_CHANGE_SOURCE } from "@/lib/constants/order-status";

function mapAddress(address) {
  return {
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country ?? "India",
  };
}

export async function buildOrderDraft(customer, payload) {
  const parsed = createOrderSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const productIds = parsed.data.items.map((item) => item.productId);
  if (productIds.some((id) => !mongoose.isValidObjectId(id))) {
    throw new ApiError(422, "Validation failed.", [
      { field: "items", message: "One or more product ids are invalid." },
    ]);
  }

  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const lineItems = [];

  for (const item of parsed.data.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new ApiError(422, "Validation failed.", [
        { field: "items", message: `Product ${item.productId} was not found.` },
      ]);
    }
    if (product.status !== PRODUCT_STATUS.ACTIVE) {
      throw new ApiError(422, "Validation failed.", [
        { field: "items", message: `${product.name} is not available for ordering.` },
      ]);
    }
    if (product.stockQuantity < item.quantity) {
      throw new ApiError(422, "Validation failed.", [
        { field: "items", message: `Insufficient stock for ${product.name}.` },
      ]);
    }

    const unitPrice = resolveUnitPrice(product, item.quantity);
    const imageUrl =
      product.images?.[0]?.secureUrl ||
      product.images?.[0]?.url ||
      product.images?.[0]?.src ||
      "";
    lineItems.push({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice,
      lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
      selectedAttributes: item.selectedAttributes ?? {},
      imageUrl,
    });
  }

  const totals = calculateOrderTotals(lineItems);
  const billingAddress = mapAddress(parsed.data.billingAddress ?? parsed.data.shippingAddress);
  const shippingAddress = mapAddress(parsed.data.shippingAddress);
  const amountPaise = rupeesToPaise(totals.totalAmount);

  if (amountPaise < 100) {
    throw new ApiError(422, "Validation failed.", [
      { field: "items", message: "Order total must be at least INR 1.00." },
    ]);
  }

  return {
    parsed,
    lineItems,
    totals,
    billingAddress,
    shippingAddress,
    amountPaise,
  };
}

export async function reserveInventoryForItems(items, session) {
  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      {
        _id: item.productId,
        stockQuantity: { $gte: item.quantity },
        status: PRODUCT_STATUS.ACTIVE,
      },
      { $inc: { stockQuantity: -item.quantity } },
      { new: true, session },
    );
    if (!updated) {
      throw new ApiError(409, "Inventory changed while placing the order. Please retry.");
    }
    if (updated.stockQuantity === 0) {
      updated.status = PRODUCT_STATUS.OUT_OF_STOCK;
      await updated.save({ session });
    }
  }
}

export async function releaseInventoryForOrder(order, session) {
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { stockQuantity: item.quantity } },
      { session },
    );
  }
}

export async function createPendingPaymentOrder(customer, payload) {
  const draft = await buildOrderDraft(customer, payload);
  const expiresAt = new Date(Date.now() + PAYMENT_RESERVATION_MINUTES * 60 * 1000);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await reserveInventoryForItems(draft.parsed.data.items, session);

    const order = await orderRepository.create(
      {
        orderNumber: generateOrderNumber(),
        customer: customer._id,
        items: draft.lineItems,
        shippingAddress: draft.shippingAddress,
        billingAddress: draft.billingAddress,
        subtotal: draft.totals.subtotal,
        discount: draft.totals.discount,
        shippingCharges: draft.totals.shippingCharges,
        tax: draft.totals.tax,
        totalAmount: draft.totals.totalAmount,
        amountPaise: draft.amountPaise,
        currency: CHECKOUT_CURRENCY,
        paymentMethod: "razorpay",
        paymentStatus: PAYMENT_STATUS.PENDING,
        orderStatus: ORDER_STATUS.PENDING_PAYMENT,
        inventoryReserved: true,
        paymentExpiresAt: expiresAt,
        notes: draft.parsed.data.notes ?? "",
        statusHistory: [
          {
            previousOrderStatus: ORDER_STATUS.PENDING,
            newOrderStatus: ORDER_STATUS.PENDING_PAYMENT,
            previousPaymentStatus: PAYMENT_STATUS.PENDING,
            newPaymentStatus: PAYMENT_STATUS.PENDING,
            source: STATUS_CHANGE_SOURCE.SYSTEM,
            customerVisibleRemark: "Order created. Awaiting payment.",
          },
        ],
      },
      session,
    );

    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function markOrderPaymentFailed(order, reason) {
  if (order.paymentStatus === PAYMENT_STATUS.PAID) return order;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (order.inventoryReserved) {
      await releaseInventoryForOrder(order, session);
      order.inventoryReserved = false;
    }
    order.paymentStatus = PAYMENT_STATUS.FAILED;
    order.orderStatus = ORDER_STATUS.CANCELLED;
    order.notes = reason ? `${order.notes}\n${reason}`.trim() : order.notes;
    await order.save({ session });
    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function finalizeCapturedOrder(order, { method = "" } = {}) {
  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    return { order, notified: false };
  }

  order.paymentStatus = PAYMENT_STATUS.PAID;
  order.orderStatus = ORDER_STATUS.CONFIRMED;
  order.inventoryReserved = false;
  order.paymentExpiresAt = null;
  if (method) order.paymentMethod = method;
  await order.save();

  let notified = false;
  if (!order.paymentConfirmedNotifiedAt) {
    const { notifyNewOrder } = await import("@/lib/services/email.service");
    await notifyNewOrder(
      typeof order.toObject === "function" ? order.toObject() : order,
    ).catch(() => undefined);
    order.paymentConfirmedNotifiedAt = new Date();
    await order.save();
    notified = true;
  }

  return { order, notified };
}

/** Legacy direct order creation kept for non-Razorpay integrations. */
export async function createOrder(customer, payload) {
  return createPendingPaymentOrder(customer, payload);
}

export async function getOrderForUser(orderId, user, isAdmin) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (
    !isAdmin &&
    (!user || String(order.customer._id ?? order.customer) !== String(user._id))
  ) {
    throw new ApiError(403, "You do not have access to this order.");
  }
  return order;
}

export async function listOrders(user, searchParams, isAdmin) {
  return listOrdersQuery(user, searchParams, isAdmin);
}

export { getOrderSummary };

export async function updateOrderStatus(orderId, payload, actor = null) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");

  const actorLabel =
    actor?.email ?? actor?.name ?? (actor?._id ? String(actor._id) : "admin");

  if (payload.internalNotes !== undefined) {
    order.internalNotes = payload.internalNotes;
  }
  if (payload.customerVisibleRemark !== undefined) {
    order.customerVisibleRemark = payload.customerVisibleRemark;
  }

  if (payload.shipmentAwb) {
    order.shipment = order.shipment ?? {};
    order.shipment.awb = payload.shipmentAwb;
    order.shipment.carrier = order.shipment.carrier || "Delhivery";
    order.shipment.createdAt = order.shipment.createdAt || new Date();
    if (payload.shipmentStatus) order.shipment.status = payload.shipmentStatus;
    if (
      [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.PACKED].includes(
        order.orderStatus,
      )
    ) {
      applyFulfillmentStatus(order, ORDER_STATUS.SHIPPED, {
        actor: actor?._id,
        actorLabel,
        source: STATUS_CHANGE_SOURCE.ADMIN,
        remarks: payload.remarks ?? "Shipment AWB assigned.",
        customerVisibleRemark: payload.customerVisibleRemark,
      });
    }
  }

  if (payload.paymentStatus && payload.paymentStatus !== order.paymentStatus) {
    applyPaymentStatus(order, payload.paymentStatus, {
      actor: actor?._id,
      actorLabel,
      source: STATUS_CHANGE_SOURCE.ADMIN,
      remarks: payload.remarks,
      customerVisibleRemark: payload.customerVisibleRemark,
    });
  }

  if (payload.orderStatus && payload.orderStatus !== order.orderStatus) {
    applyFulfillmentStatus(order, payload.orderStatus, {
      actor: actor?._id,
      actorLabel,
      source: STATUS_CHANGE_SOURCE.ADMIN,
      remarks: payload.remarks,
      customerVisibleRemark: payload.customerVisibleRemark,
    });
  } else if (payload.remarks) {
    appendOrderStatusHistory(order, {
      previousOrderStatus: order.orderStatus,
      newOrderStatus: order.orderStatus,
      previousPaymentStatus: order.paymentStatus,
      newPaymentStatus: order.paymentStatus,
      changedBy: actor?._id,
      changedByLabel: actorLabel,
      source: STATUS_CHANGE_SOURCE.ADMIN,
      remarks: payload.remarks,
      customerVisibleRemark: payload.customerVisibleRemark,
    });
  }

  await order.save();
  return order;
}
