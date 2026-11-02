import { ApiError } from "@/lib/utils/api-error";
import { ROLES } from "@/lib/constants/roles";
import { User } from "@/lib/db/models/User";
import { getAuthUser } from "@/lib/auth/session";
import { permissionsForRole, roleHasPermission } from "@/lib/auth/permissions";

/**
 * Admin calling the API in the current store: either the dashboard session
 * cookie or an API access token belonging to a `role: "admin"` user.
 * @returns {Promise<{ source: "api", user: import("mongoose").Document & Record<string, any>, adminRole: string, permissions: string[] }>}
 */
export async function resolveAdminAccess() {
  const apiUser = await getAuthUser();
  if (apiUser?.role === ROLES.ADMIN && apiUser.isActive) {
    return toAccess(apiUser);
  }

  const { getAdminSession } = await import("@/lib/admin/auth");
  const session = await getAdminSession();
  if (session) {
    const user = await User.findById(session.userId).select("-password");
    if (user) return toAccess(user);
  }

  throw new ApiError(apiUser ? 403 : 401, "Admin access required.");
}

function toAccess(user) {
  return {
    source: "api",
    user,
    adminRole: user.adminRole,
    permissions: permissionsForRole(user.adminRole),
  };
}

/**
 * Guard for every admin API operation. Pass the permission the operation
 * needs (lib/auth/permissions.js); omit it only for read-only dashboard data.
 * @param {string} [permission]
 */
export async function requireAdminAccess(permission) {
  const access = await resolveAdminAccess();
  if (permission && !roleHasPermission(access.adminRole, permission)) {
    throw new ApiError(403, "Your role does not allow this action.");
  }
  return access;
}

/**
 * @param {string} [permission]
 */
export async function requireAdminUser(permission) {
  return (await requireAdminAccess(permission)).user;
}
