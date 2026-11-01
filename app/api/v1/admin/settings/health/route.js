import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getIntegrationHealth } from "@/lib/services/integration-health.service";

export const GET = withDatabase(async () => {
  await requireAdminAccess();
  const health = await getIntegrationHealth();
  return successResponse(health, "Integration health fetched.");
});
