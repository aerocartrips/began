import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { Product } from "@/lib/db/models/Product";
import { orderRepository } from "@/lib/repositories/order.repository";
import { createOrderSchema } from "@/lib/validators/order.validator";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { generateOrderNumber, rupeesToPaise } from "@/lib/services/order-pricing";
import { priceCartItems } from "@/lib/services/cart-pricing.service";
import { getActiveTenant } from "@/lib/tenant/active";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";
import { listOrdersQuery, getOrderSummary } from "@/lib/services/order-query.service";
import {
  applyFulfillmentStatus,
  applyPaymentStatus,
  appendOrderStatusHistory,
} from "@/lib/services/order-status.service";
import { STATUS_CHANGE_SOURCE } from "@/lib/constants/order-status";
import { resolveSavedAddress } from "@/lib/services/address.service";
import {
  onOrderStatusChanged,
  onPaymentCaptured,
  onPaymentFailed,
  onStockReserved,
} from "@/lib/notifications/events";

/** Copies only snapshot fields, so later address-book edits never reach the order. */
function mapAddress(address) {
  return {
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    landmark: address.landmark ?? "",
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

  const { shippingAddressId, billingAddressId } = parsed.data;
  const shippingSource = shippingAddressId
    ? resolveSavedAddress(customer, shippingAddressId, "shippingAddressId")
    : parsed.data.shippingAddress;
  const billingSource = billingAddressId
    ? resolveSavedAddress(customer, billingAddressId, "billingAddressId")
    : parsed.data.billingAddress ?? shippingSource;

  const priced = await priceCartItems(parsed.data.items, { strict: true });
  const lineItems = priced.lines.map((line) => ({
    product: line.productId,
    variantId: line.variantId,
    productName: line.name,
    sku: line.sku,
    colorName: line.colorName,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    gstRatePercent: line.gstRatePercent,
    hsnCode: line.hsnCode,
    imageUrl: line.imageUrl,
  }));

  const { totals } = priced;
  // Business identity is frozen on the billing snapshot so invoices stay unchanged after profile edits.
  const billingAddress = {
    ...mapAddress(billingSource),
    companyName: customer.companyName ?? "",
    gstin: billingSource.gstin || customer.gstNumber || "",
  };
  const shippingAddress = mapAddress(shippingSource);
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

/**
 * @returns {Promise<{ productId: unknown; name: string; previousStock: number; stock: number }[]>}
 *   stock levels after reservation, for inventory alerts once the transaction commits
 */
export async function reserveInventoryForItems(items, session) {
  const changes = [];
  for (const item of items) {
    // Variant and product totals move together in one atomic update.
    const filter = item.variantId
      ? { _id: item.productId, status: PRODUCT_STATUS.ACTIVE, variants: { $elemMatch: { _id: item.variantId, stockQuantity: { $gte: item.quantity } } } }
      : { _id: item.productId, status: PRODUCT_STATUS.ACTIVE, stockQuantity: { $gte: item.quantity } };
    const update = item.variantId
      ? { $inc: { stockQuantity: -item.quantity, "variants.$.stockQuantity": -item.quantity } }
      : { $inc: { stockQuantity: -item.quantity } };
    const updated = await Product.findOneAndUpdate(filter, update, { returnDocument: "after", session });
    if (!updated) {
      throw new ApiError(409, "Inventory changed while placing the order. Please retry.");
    }
    changes.push({
      productId: updated._id,
      name: updated.name,
      previousStock: updated.stockQuantity + item.quantity,
      stock: updated.stockQuantity,
    });
  }
  return changes;
}

export async function releaseInventoryForOrder(order, session) {
  for (const item of order.items) {
    const filter = item.variantId ? { _id: item.product, "variants._id": item.variantId } : { _id: item.product };
    const update = item.variantId
      ? { $inc: { stockQuantity: item.quantity, "variants.$.stockQuantity": item.quantity } }
      : { $inc: { stockQuantity: item.quantity } };
    await Product.updateOne(filter, update, { session });
  }
}

export async function createPendingPaymentOrder(customer, payload) {
  const [draft, settings] = await Promise.all([buildOrderDraft(customer, payload), getStoreSettingsDocument()]);
  const expiresAt = new Date(Date.now() + settings.orders.paymentReservationMinutes * 60 * 1000);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const stockChanges = await reserveInventoryForItems(draft.parsed.data.items, session);

    const order = await orderRepository.create(
      {
        orderNumber: generateOrderNumber((await getActiveTenant()).slug),
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
        currency: "INR",
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
    onStockReserved(stockChanges, settings.commerce.lowStockThreshold);
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * @param {import("mongoose").Document & Record<string, any>} order
 * @param {string} reason
 * @param {{ expired?: boolean }} [options]
 */
export async function markOrderPaymentFailed(order, reason, { expired = false } = {}) {
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
    onPaymentFailed(order, { expired });
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
  onPaymentCaptured(order);

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
  const previousOrderStatus = order.orderStatus;

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
  onOrderStatusChanged(order, previousOrderStatus, {
    source: STATUS_CHANGE_SOURCE.ADMIN,
    remark: payload.customerVisibleRemark,
  });
  return order;
}
