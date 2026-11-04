import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getJobRuns, PAYMENT_EXPIRY_JOB_NAME } from "@/lib/jobs/payment-expiry.job";
import { PRODUCT_METRICS_JOB_NAME } from "@/lib/jobs/product-metrics.job";

export const GET = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.JOBS_RUN);
  const [paymentRuns, metricsRuns] = await Promise.all([
    getJobRuns(PAYMENT_EXPIRY_JOB_NAME, 30),
    getJobRuns(PRODUCT_METRICS_JOB_NAME, 30),
  ]);
  return successResponse(
    {
      jobs: [
        {
          name: PAYMENT_EXPIRY_JOB_NAME,
          description: "Expires pending_payment orders and releases inventory once.",
          runPath: "/api/v1/admin/jobs/payment-expiry",
          runs: paymentRuns,
        },
        {
          name: PRODUCT_METRICS_JOB_NAME,
          description: "Recomputes best sellers, popularity and trending from orders, views, wishlists and carts.",
          runPath: "/api/v1/admin/jobs/product-metrics",
          runs: metricsRuns,
        },
      ],
    },
    "Job status fetched.",
  );
});
