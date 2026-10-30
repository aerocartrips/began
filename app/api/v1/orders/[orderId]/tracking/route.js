import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getAuthUser } from "@/lib/middleware/auth";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { ROLES } from "@/lib/constants/roles";
import { getOrderForUser } from "@/lib/services/order.service";
import {
  getOrderPaymentSummary,
  getOrderTracking,
} from "@/lib/services/order-actions.service";
import { ApiError } from "@/lib/utils/api-error";

export const GET = withDatabase(async (request, context) => {
  const { orderId } = await context.params;
  const sessionUser = await getAuthUser();
  let isAdmin = false;
  let user = sessionUser;

  if (sessionUser) {
    isAdmin = sessionUser.role === ROLES.ADMIN;
  } else {
    await requireCommerceAdmin();
    isAdmin = true;
    user = null;
  }

  const order = await getOrderForUser(orderId, user, isAdmin);
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
