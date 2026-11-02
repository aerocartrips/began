import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { assertCronSecret } from "@/lib/jobs/cron-auth";
import { runForEachTenant } from "@/lib/jobs/for-each-tenant";
import { PAYMENT_EXPIRY_JOB_NAME, runPaymentExpiryJob } from "@/lib/jobs/payment-expiry.job";

export const GET = withDatabase(
  async (request) => {
    assertCronSecret(request);
    const runs = await runForEachTenant(PAYMENT_EXPIRY_JOB_NAME, () =>
      runPaymentExpiryJob({ triggeredBy: "cron" }),
    );
    return successResponse(runs, "Payment expiry job completed.");
  },
  { tenant: false },
);
