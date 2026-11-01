import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { updateOrderStatus } from "@/lib/services/order.service";
import { updateOrderStatusSchema } from "@/lib/validators/order.validator";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { ApiError } from "@/lib/utils/api-error";

export const PATCH = withDatabase(async (request, context) => {
  const adminAccess = await requireAdminAccess();
  const adminUser =
    adminAccess.source === "api"
      ? adminAccess.user
      : { _id: undefined, email: adminAccess.session.email, name: adminAccess.session.email };
  const { orderId } = await context.params;
  const payload = await parseJsonBody(request);
  const parsed = updateOrderStatusSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }
  const order = await updateOrderStatus(orderId, parsed.data, adminUser);
  return successResponse(order, "Order status updated successfully.");
});
