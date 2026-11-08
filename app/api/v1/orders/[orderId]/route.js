import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { resolveViewer } from "@/lib/auth/viewer";
import { getOrderForUser } from "@/lib/services/order.service";
import { getOrderPaymentSummary } from "@/lib/services/order-actions.service";
import { presentOrderToCustomer, toCustomerPayment } from "@/lib/services/order-dto";

export const GET = withDatabase(async (_request, context) => {
  const { orderId } = await context.params;
  const { customer } = await resolveViewer(PERMISSIONS.ORDERS_MANAGE);
  const order = await getOrderForUser(orderId, customer, !customer);

  if (!customer) {
    const payment = await getOrderPaymentSummary(orderId);
    return successResponse({ order, payment }, "Order fetched successfully.");
  }
  const [view, payment] = await Promise.all([presentOrderToCustomer(order), getOrderPaymentSummary(orderId)]);
  return successResponse({ order: view, payment: toCustomerPayment(payment) }, "Order fetched successfully.");
});
