import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { verifyPaymentSchema } from "@/lib/validators/payment.validator";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { reconcileCapturedPayment } from "@/lib/services/payment-verification.service";
import { ApiError } from "@/lib/utils/api-error";
import { toCustomerOrderSummary, toCustomerPayment } from "@/lib/services/order-dto";

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const payload = await parseJsonBody(request);
  const parsed = verifyPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const result = await reconcileCapturedPayment({
    userId: user._id,
    razorpayOrderId: parsed.data.razorpay_order_id,
    razorpayPaymentId: parsed.data.razorpay_payment_id,
    razorpaySignature: parsed.data.razorpay_signature,
  });

  return successResponse(
    {
      payment: toCustomerPayment(result.payment),
      order: result.order ? toCustomerOrderSummary(result.order) : null,
      idempotent: result.idempotent,
    },
    result.idempotent ? "Payment already verified." : "Payment verified successfully.",
  );
});
