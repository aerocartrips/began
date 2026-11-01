import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getAuthUser } from "@/lib/auth/session";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { ROLES } from "@/lib/constants/roles";
import { getOrderForUser } from "@/lib/services/order.service";
import { getOrderPaymentSummary } from "@/lib/services/order-actions.service";

export const GET = withDatabase(async (_request, context) => {
  const { orderId } = await context.params;
  const sessionUser = await getAuthUser();

  if (sessionUser) {
    const isAdmin = sessionUser.role === ROLES.ADMIN;
    const order = await getOrderForUser(orderId, sessionUser, isAdmin);
    const payment = await getOrderPaymentSummary(orderId);
    return successResponse({ order, payment }, "Order fetched successfully.");
  }

  await requireAdminAccess();
  const order = await getOrderForUser(orderId, null, true);
  const payment = await getOrderPaymentSummary(orderId);
  return successResponse({ order, payment }, "Order fetched successfully.");
});
