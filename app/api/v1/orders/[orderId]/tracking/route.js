import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { resolveViewer } from "@/lib/auth/viewer";
import { getOrderForUser } from "@/lib/services/order.service";
import { getOrderTracking } from "@/lib/services/order-actions.service";
import { ApiError } from "@/lib/utils/api-error";

export const GET = withDatabase(async (request, context) => {
  const { orderId } = await context.params;
  const { customer } = await resolveViewer(PERMISSIONS.ORDERS_MANAGE);
  const order = await getOrderForUser(orderId, customer, !customer);
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";

  try {
    const tracking = await getOrderTracking(order, { refresh });
    return successResponse(tracking, "Tracking fetched successfully.");
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      return successResponse(
        { available: false, message: error.message },
        "Tracking unavailable.",
      );
    }
    throw error;
  }
});
