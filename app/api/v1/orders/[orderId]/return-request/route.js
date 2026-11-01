import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { createCustomerReturnRequest } from "@/lib/services/order-actions.service";

export const POST = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { orderId } = await context.params;
  const payload = await parseJsonBody(request);
  const order = await createCustomerReturnRequest(orderId, user, payload);
  return successResponse(order, "Return request submitted successfully.", undefined, 201);
});
