import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getCustomerDetail, getCustomerById, updateCustomer } from "@/lib/services/customer.service";

export const GET = withDatabase(async (request, context) => {
  await requireAdminAccess(PERMISSIONS.CUSTOMERS_MANAGE);
  const { customerId } = await context.params;
  const detail = new URL(request.url).searchParams.get("detail") === "1";
  if (detail) {
    const result = await getCustomerDetail(customerId);
    return successResponse(result, "Customer detail fetched.");
  }
  const customer = await getCustomerById(customerId);
  return successResponse(customer, "Customer fetched successfully.");
});

export const PATCH = withDatabase(async (request, context) => {
  await requireAdminAccess(PERMISSIONS.CUSTOMERS_MANAGE);
  const { customerId } = await context.params;
  const payload = await parseJsonBody(request);
  const customer = await updateCustomer(customerId, payload);
  return successResponse(customer, "Customer updated successfully.");
});
