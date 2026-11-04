import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { assertCronSecret } from "@/lib/jobs/cron-auth";
import { runForEachTenant } from "@/lib/jobs/for-each-tenant";
import { PRODUCT_METRICS_JOB_NAME, runProductMetricsJob } from "@/lib/jobs/product-metrics.job";

/** Recomputes best sellers, popularity and trending for every store. Schedule hourly. */
export const GET = withDatabase(
  async (request) => {
    assertCronSecret(request);
    const runs = await runForEachTenant(PRODUCT_METRICS_JOB_NAME, () => runProductMetricsJob({ triggeredBy: "cron" }));
    return successResponse(runs, "Product metrics job completed.");
  },
  { tenant: false },
);
