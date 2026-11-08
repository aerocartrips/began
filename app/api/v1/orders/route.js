import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { resolveViewer } from "@/lib/auth/viewer";
import { listOrders } from "@/lib/services/order.service";
import { toCustomerOrderSummary } from "@/lib/services/order-dto";

/**
 * The customer's own orders, or every order for staff. Orders are created by
 * checkout (POST /api/v1/payments/create-order), which also starts the payment.
 */
export const GET = withDatabase(async (request) => {
  const { searchParams } = new URL(request.url);
  const { customer } = await resolveViewer(PERMISSIONS.ORDERS_MANAGE);
  const result = await listOrders(customer, searchParams, !customer);
  const items = customer ? result.items.map(toCustomerOrderSummary) : result.items;
  return successResponse(items, "Orders fetched successfully.", result.meta);
});
