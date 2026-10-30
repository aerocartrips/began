import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/middleware/auth";
import { ROLES } from "@/lib/constants/roles";
import { getPaymentForUser } from "@/lib/services/payment.service";

export const GET = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { paymentId } = await context.params;
  const payment = await getPaymentForUser(paymentId, user, user.role === ROLES.ADMIN);
  return successResponse(payment, "Payment fetched successfully.");
});
