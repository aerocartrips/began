import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/middleware/auth";
import { cancelCustomerOrder } from "@/lib/services/order-actions.service";

export const POST = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { orderId } = await context.params;
  const payload = await parseJsonBody(request);
  const result = await cancelCustomerOrder(orderId, user, payload);
  const refundMessage =
    result.refund?.status === "pending"
      ? "Order cancelled. Your refund has been initiated and will be confirmed shortly."
      : result.refund?.status === "manual_review" || result.refund?.status === "failed"
        ? "Order cancelled. Refund requires manual review — our team will follow up."
        : "Order cancelled successfully.";
  return successResponse(result.order, refundMessage);
});
