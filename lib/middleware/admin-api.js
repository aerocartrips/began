import { ApiError } from "@/lib/utils/api-error";
import { ROLES } from "@/lib/constants/roles";
import { getAuthUser } from "@/lib/middleware/auth";

/**
 * Allows MongoDB admin JWT sessions or the existing dashboard admin cookie.
 */
export async function requireImageAdmin() {
  const apiUser = await getAuthUser();
  if (apiUser?.role === ROLES.ADMIN && apiUser.isActive) {
    return { source: "api", user: apiUser };
  }

  const { getAdminSession } = await import("@/lib/admin/auth");
  const dashboardSession = await getAdminSession();
  if (dashboardSession) {
    return { source: "dashboard", session: dashboardSession };
  }

  throw new ApiError(401, "Admin access required.");
}

export async function requireFinanceAdmin() {
  return requireImageAdmin();
}

/** Dashboard cookie or Mongo admin JWT — for commerce read/write in admin UI. */
export async function requireCommerceAdmin() {
  return requireImageAdmin();
}
