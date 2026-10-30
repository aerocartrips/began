import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { runPaymentExpiryJob } from "@/lib/jobs/payment-expiry.job";

export const POST = withDatabase(async () => {
  await requireCommerceAdmin();
  const run = await runPaymentExpiryJob({ triggeredBy: "admin" });
  return successResponse(run, "Payment expiry job completed.");
});
