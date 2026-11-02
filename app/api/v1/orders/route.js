import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getAuthUser, requireAuthUser } from "@/lib/auth/session";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { ROLES } from "@/lib/constants/roles";
import { createOrder, listOrders } from "@/lib/services/order.service";

export const GET = withDatabase(async (request) => {
  const { searchParams } = new URL(request.url);
  const sessionUser = await getAuthUser();

  if (sessionUser) {
    const isAdmin = sessionUser.role === ROLES.ADMIN;
    const result = await listOrders(sessionUser, searchParams, isAdmin);
    return successResponse(result.items, "Orders fetched successfully.", result.meta);
  }

  await requireAdminAccess(PERMISSIONS.ORDERS_MANAGE);
  const result = await listOrders(null, searchParams, true);
  return successResponse(result.items, "Orders fetched successfully.", result.meta);
});

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const payload = await parseJsonBody(request, 64 * 1024);
  const order = await createOrder(user, payload);
  return successResponse(order, "Order created successfully.", undefined, 201);
});
