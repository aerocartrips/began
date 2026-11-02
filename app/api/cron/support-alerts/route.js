import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { assertCronSecret } from "@/lib/jobs/cron-auth";
import { runForEachTenant } from "@/lib/jobs/for-each-tenant";
import { runSupportUnansweredAlertsJob } from "@/lib/jobs/support-alerts.job";

export const GET = withDatabase(
  async (request) => {
    assertCronSecret(request);
    const runs = await runForEachTenant("support_alerts", () =>
      runSupportUnansweredAlertsJob({ triggeredBy: "cron" }),
    );
    return successResponse(runs, "Support alerts job completed.");
  },
  { tenant: false },
);
