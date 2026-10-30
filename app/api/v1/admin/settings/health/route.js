import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { getIntegrationHealth } from "@/lib/services/integration-health.service";

export const GET = withDatabase(async () => {
  await requireCommerceAdmin();
  const health = await getIntegrationHealth();
  return successResponse(health, "Integration health fetched.");
});
