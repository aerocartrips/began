import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { anonymizeCustomer } from "@/lib/services/account-security.service";

export const POST = withDatabase(async (request, context) => {
  const access = await requireAdminAccess();
  const { customerId } = await context.params;
  const result = await anonymizeCustomer(customerId, access.user);
  return successResponse(result, "Customer account anonymized.");
});
