import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { runProductMetricsJob } from "@/lib/jobs/product-metrics.job";

export const POST = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.JOBS_RUN);
  const run = await runProductMetricsJob({ triggeredBy: "admin" });
  return successResponse(run, "Product metrics job completed.");
});
