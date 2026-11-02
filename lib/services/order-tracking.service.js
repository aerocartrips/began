import { z } from "zod";
import { ApiError } from "@/lib/utils/api-error";
import { Order } from "@/lib/db/models/Order";
import { User } from "@/lib/db/models/User";
import { getOrderTracking } from "@/lib/services/order-actions.service";
import { logger } from "@/lib/utils/logger";

const trackSchema = z.object({
  orderNumber: z.string().trim().toUpperCase().min(6).max(40),
  contact: z.string().trim().min(5).max(254),
});

/** Same response for "no such order" and "wrong contact", so order numbers cannot be probed. */
const NOT_FOUND = "We could not find an order with those details.";

const digits = (value) => String(value ?? "").replace(/\D/g, "").slice(-10);

function contactMatches(contact, order, customerEmail) {
  if (contact.includes("@")) return contact.toLowerCase() === String(customerEmail ?? "").toLowerCase();
  const phone = digits(contact);
  return phone.length === 10 && [order.shippingAddress?.phone, order.billingAddress?.phone].some((value) => digits(value) === phone);
}

/**
 * Order status for a shopper who is not signed in. Requires the order number
 * plus the email or phone used on the order; returns no addresses or prices.
 * @param {unknown} payload
 */
export async function trackOrderForGuest(payload) {
  const parsed = trackSchema.safeParse(payload);
  if (!parsed.success) throw new ApiError(422, "Enter your order number and the email or phone used at checkout.");
  const { orderNumber, contact } = parsed.data;

  const order = await Order.findOne({ orderNumber });
  const customer = order ? await User.findById(order.customer).select("email").lean() : null;
  if (!order || !contactMatches(contact, order, customer?.email)) throw new ApiError(404, NOT_FOUND);

  let tracking = null;
  if (order.shipment?.awb) {
    tracking = await getOrderTracking(order).catch((error) => {
      logger.warn("Guest tracking lookup failed", { error, orderNumber });
      return null;
    });
  }

  return {
    orderNumber: order.orderNumber,
    placedAt: order.createdAt,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    items: order.items.map((item) => ({ name: item.productName, colorName: item.colorName ?? "", quantity: item.quantity })),
    timeline: (order.statusHistory ?? [])
      .filter((entry) => entry.newOrderStatus)
      .map((entry) => ({ status: entry.newOrderStatus, at: entry.changedAt ?? entry.createdAt })),
    shipment: order.shipment?.awb
      ? {
          carrier: order.shipment.carrier,
          awb: order.shipment.awb,
          status: tracking?.status || order.shipment.status || "",
          estimatedDelivery: order.shipment.estimatedDelivery,
          events: (tracking?.events ?? []).slice(0, 20),
        }
      : null,
  };
}
