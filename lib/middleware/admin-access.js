import { ApiError } from "@/lib/utils/api-error";
import { ROLES } from "@/lib/constants/roles";
import { User } from "@/lib/db/models/User";
import { getAuthUser } from "@/lib/middleware/auth";

/**
 * Accepts MongoDB admin JWT (norosilk_access) or dashboard admin cookie (neov-admin-session).
 */
export async function resolveAdminAccess() {
  const apiUser = await getAuthUser();
  if (apiUser?.role === ROLES.ADMIN && apiUser.isActive) {
    return { source: "api", user: apiUser };
  }

  const { getAdminSession } = await import("@/lib/admin/auth");
  const dashboardSession = await getAdminSession();
  if (dashboardSession) {
    const dbUser = await User.findOne({
      email: dashboardSession.email.toLowerCase(),
      role: ROLES.ADMIN,
      isActive: true,
    }).select("-password");

    if (dbUser) {
      return { source: "api", user: dbUser };
    }

    return {
      source: "dashboard",
      session: dashboardSession,
      user: {
        email: dashboardSession.email,
        role: ROLES.ADMIN,
        isActive: true,
        name: "Dashboard Admin",
      },
    };
  }

  if (!apiUser) {
    throw new ApiError(401, "Admin access required.");
  }
  throw new ApiError(403, "Admin access required.");
}

/** @returns {import("mongoose").Document | Record<string, unknown>} */
export async function requireAdminUser() {
  const access = await resolveAdminAccess();
  return access.user;
}

export async function requireCommerceAdmin() {
  return resolveAdminAccess();
}

export async function requireImageAdmin() {
  return resolveAdminAccess();
}

export async function requireFinanceAdmin() {
  return resolveAdminAccess();
}
