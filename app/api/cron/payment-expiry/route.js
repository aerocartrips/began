import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { assertCronSecret } from "@/lib/jobs/cron-auth";
import { runPaymentExpiryJob } from "@/lib/jobs/payment-expiry.job";

export const GET = withDatabase(async (request) => {
  assertCronSecret(request);
  const run = await runPaymentExpiryJob({ triggeredBy: "cron" });
  return successResponse(run, "Payment expiry job completed.");
});
