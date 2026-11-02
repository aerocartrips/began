import { requireAdmin } from "@/lib/admin/auth";
import { withCurrentTenant } from "@/lib/tenant/current";

/** Admin page guard: sign-in redirect, or the 403 page when the role lacks `permission`. */
export function guardAdminPage(permission: string) {
  return withCurrentTenant(() => requireAdmin(permission));
}
