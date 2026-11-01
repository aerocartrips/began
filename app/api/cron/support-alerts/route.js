import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { assertCronSecret } from "@/lib/jobs/cron-auth";
import { runSupportUnansweredAlertsJob } from "@/lib/jobs/support-alerts.job";

export const GET = withDatabase(async (request) => {
  assertCronSecret(request);
  const run = await runSupportUnansweredAlertsJob({ triggeredBy: "cron" });
  return successResponse(run, "Support alerts job completed.");
});
