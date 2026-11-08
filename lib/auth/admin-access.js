import { ApiError } from "@/lib/utils/api-error";
import { ROLES } from "@/lib/constants/roles";
import { User } from "@/lib/db/models/User";
import { authenticationRequired, getAuthUser } from "@/lib/auth/session";
import { permissionsForRole, roleHasPermission } from "@/lib/auth/permissions";

/**
 * Store staff calling the API in the current store, signed in through the admin
 * sign-in (the admin session cookie). Storefront tokens only ever belong to
 * customers (lib/auth/session.js), so they never grant admin access.
 * @returns {Promise<{ source: "admin_session", user: import("mongoose").Document & Record<string, any>, adminRole: string, permissions: string[] }>}
 */
export async function resolveAdminAccess() {
  const { getAdminSession } = await import("@/lib/admin/auth");
  const session = await getAdminSession();
  if (session) {
    const user = await User.findOne({ _id: session.userId, role: ROLES.ADMIN, isActive: true }).select("-password");
    if (user) return toAccess(user);
  }

  // Customer routes that also serve admins (orders, summaries) end up here for
  // shoppers: a signed-in customer is refused (403), anyone else may sign in (401).
  if (await getAuthUser()) throw new ApiError(403, "Admin access required.");
  throw await authenticationRequired("Admin access required.");
}

function toAccess(user) {
  return {
    source: "admin_session",
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
