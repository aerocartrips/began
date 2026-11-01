import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getOrderForUser } from "@/lib/services/order.service";
import { refreshCustomerOrderPayment } from "@/lib/services/order-actions.service";

export const POST = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  const { orderId } = await context.params;
  await getOrderForUser(orderId, user, false);
  const result = await refreshCustomerOrderPayment(orderId, user);
  return successResponse(result, "Payment status refreshed successfully.");
});
