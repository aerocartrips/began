import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminUser } from "@/lib/auth/admin-access";
import {
  createOrderShipmentBooking,
  generateOrderShipmentManifest,
  reconcileOrderShipmentBooking,
} from "@/lib/services/shipment.service";
import { getOrderTracking } from "@/lib/services/order-actions.service";
import { orderRepository } from "@/lib/repositories/order.repository";

export const POST = withDatabase(async (request, context) => {
  const admin = await requireAdminUser(PERMISSIONS.ORDERS_MANAGE);
  const { orderId } = await context.params;
  const action = new URL(request.url).searchParams.get("action") || "book";

  if (action === "manifest") {
    const order = await generateOrderShipmentManifest(orderId, admin);
    return successResponse({ order }, "Manifest generated.");
  }
  if (action === "reconcile") {
    const order = await reconcileOrderShipmentBooking(orderId);
    return successResponse({ order }, "Shipment booking state loaded for reconciliation.");
  }
  if (action === "refresh-tracking") {
    const order = await orderRepository.findById(orderId);
    const tracking = await getOrderTracking(order, { refresh: true });
    return successResponse({ tracking, order }, "Tracking refreshed.");
  }

  const order = await createOrderShipmentBooking(orderId, admin);
  return successResponse({ order }, "Shipment booking submitted.");
});
