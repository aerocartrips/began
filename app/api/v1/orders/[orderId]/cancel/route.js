import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { cancelCustomerOrder } from "@/lib/services/order-actions.service";
import { presentOrderToCustomer } from "@/lib/services/order-dto";

const REFUND_MESSAGES = {
  pending: "Order cancelled. Your refund has been initiated and will be confirmed shortly.",
  processing: "Order cancelled. Your refund is already being processed.",
  manual_review: "Order cancelled. Refund requires manual review — our team will follow up.",
  failed: "Order cancelled. Refund requires manual review — our team will follow up.",
};

export const POST = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { orderId } = await context.params;
  const payload = await parseJsonBody(request);
  const result = await cancelCustomerOrder(orderId, user, payload);
  const message = REFUND_MESSAGES[result.refund?.status] ?? "Order cancelled successfully.";
  return successResponse(await presentOrderToCustomer(result.order), message);
});
