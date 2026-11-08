import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { refreshCustomerOrderPayment } from "@/lib/services/order-actions.service";
import { presentOrderToCustomer, toCustomerPayment } from "@/lib/services/order-dto";

const MESSAGES = {
  paid: "Payment confirmed.",
  authorized: "Your bank approved the payment; it will be confirmed shortly.",
  unpaid: "No completed payment was found for this order yet.",
  no_payment: "No payment was started for this order.",
};

export const POST = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  const { orderId } = await context.params;
  const result = await refreshCustomerOrderPayment(orderId, user);
  return successResponse(
    { order: await presentOrderToCustomer(result.order), payment: toCustomerPayment(result.payment), state: result.state },
    MESSAGES[result.state],
  );
});
