import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { resolveViewer } from "@/lib/auth/viewer";
import { getPaymentForUser } from "@/lib/services/payment.service";
import { toCustomerOrderSummary, toCustomerPayment } from "@/lib/services/order-dto";

export const GET = withDatabase(async (_request, context) => {
  const { paymentId } = await context.params;
  const { customer } = await resolveViewer(PERMISSIONS.PAYMENTS_REFUND);
  const payment = await getPaymentForUser(paymentId, customer, !customer);
  if (!customer) return successResponse(payment, "Payment fetched successfully.");
  return successResponse(
    { ...toCustomerPayment(payment), order: payment.order ? toCustomerOrderSummary(payment.order) : null },
    "Payment fetched successfully.",
  );
});
