import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getJobRuns, PAYMENT_EXPIRY_JOB_NAME } from "@/lib/jobs/payment-expiry.job";

export const GET = withDatabase(async () => {
  await requireAdminAccess();
  const runs = await getJobRuns(PAYMENT_EXPIRY_JOB_NAME, 30);
  return successResponse(
    {
      jobs: [
        {
          name: PAYMENT_EXPIRY_JOB_NAME,
          description: "Expires pending_payment orders and releases inventory once.",
          runs,
        },
      ],
    },
    "Job status fetched.",
  );
});
