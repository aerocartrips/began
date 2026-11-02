import mongoose from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";
import { Order } from "@/lib/db/models/Order";
import { ApiError } from "@/lib/utils/api-error";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { getActiveTenant } from "@/lib/tenant/active";
import {
  getDelhiveryB2BBookingPath,
  getDelhiveryB2BManifestPath,
  isDelhiveryB2BConfigured,
} from "@/lib/delhivery/b2b-config";
import { delhiveryB2BRequest } from "@/lib/delhivery/b2b-client";
import { onManifestFailed, onShipmentBooked, onShipmentBookingFailed } from "@/lib/notifications/events";

const ELIGIBLE_ORDER_STATUSES = new Set([
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PACKED,
]);

function summarizeResponse(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload.slice(0, 480);
  const awb = payload.awb ?? payload.AWB ?? payload.lrnum ?? payload.lr_number;
  if (awb) return `AWB/LR: ${awb}`;
  return JSON.stringify(payload).slice(0, 480);
}

function extractBookingIdentifiers(payload) {
  if (!payload || typeof payload !== "object") return { awb: "", lrNumber: "" };
  return {
    awb: String(payload.awb ?? payload.AWB ?? payload.waybill ?? "").trim(),
    lrNumber: String(payload.lrnum ?? payload.lr_number ?? payload.lrNumber ?? "").trim(),
  };
}

export async function assertOrderShipmentEligible(order) {
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new ApiError(409, "Shipment can only be created for paid orders.");
  }
  if (!ELIGIBLE_ORDER_STATUSES.has(order.orderStatus)) {
    throw new ApiError(409, "Order is not in a fulfillment-ready status.");
  }
  if (order.shipment?.bookingStatus === "booked" && order.shipment?.awb) {
    throw new ApiError(409, "A shipment is already booked for this order.");
  }
  const pincode = order.shippingAddress?.pincode?.trim();
  if (!pincode) {
    throw new ApiError(422, "Shipping address pincode is required.");
  }
  const settings = await getStoreSettingsDocument();
  if (!settings.shipping.pickupPincode?.trim()) {
    throw new ApiError(422, "Configure pickup pincode in store settings before booking.");
  }
}

export async function buildDelhiveryBookingPayload(order, settings) {
  const weight =
    order.shipment?.packageWeightKg > 0
      ? order.shipment.packageWeightKg
      : settings.shipping.defaultWeightKg;
  const boxes =
    order.shipment?.boxCount > 0 ? order.shipment.boxCount : settings.shipping.defaultBoxCount;

  return {
    order_id: order.orderNumber,
    consignee_name: order.shippingAddress.fullName,
    consignee_phone: order.shippingAddress.phone,
    consignee_address: [
      order.shippingAddress.addressLine1,
      order.shippingAddress.addressLine2,
      order.shippingAddress.landmark,
      order.shippingAddress.city,
      order.shippingAddress.state,
    ]
      .filter(Boolean)
      .join(", "),
    consignee_pincode: order.shippingAddress.pincode,
    pickup_location: settings.shipping.pickupLocationName || (await getActiveTenant()).name,
    pickup_pincode: settings.shipping.pickupPincode,
    weight_kg: weight,
    box_count: boxes,
    invoice_value: order.totalAmount,
    payment_mode: settings.shipping.freightMode || "prepaid",
  };
}

export async function createOrderShipmentBooking(orderId, adminUser) {
  if (!mongoose.isValidObjectId(orderId)) throw new ApiError(404, "Order not found.");
  if (!(await isDelhiveryB2BConfigured())) {
    throw new ApiError(
      503,
      "Delhivery B2B booking is not configured. Set DELHIVERY_B2B_* variables and DELHIVERY_B2B_BOOKING_PATH from official Delhivery B2B documentation.",
    );
  }

  const lockCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      "shipment.bookingStatus": { $in: ["not_created", "booking_failed", "reconciliation_required"] },
      $or: [{ "shipment.bookingLockedAt": null }, { "shipment.bookingLockedAt": { $lte: lockCutoff } }],
    },
    { $set: { "shipment.bookingStatus": "booking", "shipment.bookingLockedAt": new Date() } },
    { new: true },
  );

  if (!order) {
    const existing = await Order.findById(orderId);
    if (existing?.shipment?.bookingStatus === "booked") {
      throw new ApiError(409, "Shipment already booked.");
    }
    throw new ApiError(409, "Shipment booking is already in progress.");
  }

  await assertOrderShipmentEligible(order);
  const settings = await getStoreSettingsDocument();
  const payload = await buildDelhiveryBookingPayload(order, settings);
  const path = getDelhiveryB2BBookingPath();
  const attempt = {
    at: new Date(),
    status: "booking",
    requestId: order.orderNumber,
    responseSummary: "",
    error: "",
  };

  try {
    const { ok, status, payload: responsePayload } = await delhiveryB2BRequest(path, {
      method: "POST",
      body: payload,
    });

    attempt.responseSummary = summarizeResponse(responsePayload);
    order.shipment.bookingAttempts.push(attempt);
    order.shipment.lastBookingResponse = responsePayload;

    if (!ok) {
      order.shipment.bookingStatus = "booking_failed";
      attempt.status = "failed";
      attempt.error = `HTTP ${status}`;
      await order.save();
      onShipmentBookingFailed(order, { reconciliation: false, detail: attempt.responseSummary || `HTTP ${status}` });
      throw new ApiError(502, "Delhivery rejected the shipment booking request.", [
        { field: "delhivery", message: attempt.responseSummary || `HTTP ${status}` },
      ]);
    }

    const { awb, lrNumber } = extractBookingIdentifiers(responsePayload);
    order.shipment.bookingStatus = "booked";
    order.shipment.awb = awb || order.shipment.awb;
    order.shipment.lrNumber = lrNumber || order.shipment.lrNumber;
    order.shipment.createdAt = new Date();
    order.shipment.packageWeightKg = payload.weight_kg;
    order.shipment.boxCount = payload.box_count;
    order.shipment.freightMode = payload.payment_mode;
    order.internalNotes = `${order.internalNotes}\nShipment booked by ${adminUser.email ?? adminUser._id}.`.trim();
    await order.save();
    onShipmentBooked(order);
    return order;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    order.shipment.bookingStatus = "reconciliation_required";
    attempt.status = "reconciliation_required";
    attempt.error = String(error?.message ?? error).slice(0, 480);
    if (!order.shipment.bookingAttempts.some((row) => row.at?.getTime?.() === attempt.at.getTime())) {
      order.shipment.bookingAttempts.push(attempt);
    }
    await order.save();
    onShipmentBookingFailed(order, { reconciliation: true });
    throw new ApiError(502, "Shipment booking failed after submission. Reconcile before retrying.");
  }
}

export async function generateOrderShipmentManifest(orderId, adminUser) {
  const manifestPath = getDelhiveryB2BManifestPath();
  if (!manifestPath) {
    throw new ApiError(
      503,
      "Manifest path is not configured. Set DELHIVERY_B2B_MANIFEST_PATH from official Delhivery B2B documentation.",
    );
  }

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.shipment?.bookingStatus !== "booked" || !order.shipment?.awb) {
    throw new ApiError(409, "Book a shipment before generating a manifest.");
  }

  const { ok, status, payload } = await delhiveryB2BRequest(manifestPath, {
    method: "POST",
    body: { awb: order.shipment.awb, lr_number: order.shipment.lrNumber },
  });

  if (!ok) {
    onManifestFailed(order, summarizeResponse(payload) || `HTTP ${status}`);
    throw new ApiError(502, "Manifest generation failed.", [
      { field: "delhivery", message: summarizeResponse(payload) || `HTTP ${status}` },
    ]);
  }

  order.shipment.manifestStatus = "generated";
  order.shipment.bookingStatus = "manifest_generated";
  order.internalNotes = `${order.internalNotes}\nManifest generated by ${adminUser.email ?? adminUser._id}.`.trim();
  await order.save();
  return order;
}

export async function reconcileOrderShipmentBooking(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.shipment?.bookingStatus !== "reconciliation_required") {
    throw new ApiError(409, "No reconciliation is required for this shipment.");
  }
  return order;
}
