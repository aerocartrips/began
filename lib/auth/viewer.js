import { getAuthUser } from "@/lib/auth/session";
import { requireAdminAccess } from "@/lib/auth/admin-access";

/**
 * @typedef {{ customer: import("mongoose").Document & Record<string, any>, admin: null }} CustomerViewer
 * @typedef {{ customer: null, admin: Awaited<ReturnType<typeof requireAdminAccess>> }} AdminViewer
 */

/**
 * Caller of a route that serves both shoppers and store staff (orders, order
 * tracking, invoices, payments): a signed-in customer, who sees only their own
 * records in the customer view, or otherwise an admin holding `permission`, who
 * sees the full record. Throws 401/403 for anyone else.
 * @param {string} [permission] admin permission required when there is no customer session (omit: any staff member)
 * @returns {Promise<CustomerViewer | AdminViewer>}
 */
export async function resolveViewer(permission) {
  const customer = await getAuthUser();
  if (customer) return { customer, admin: null };
  return { customer: null, admin: await requireAdminAccess(permission) };
}
