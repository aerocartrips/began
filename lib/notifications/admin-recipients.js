import { ADMIN_AUDIENCE, ADMIN_AUDIENCE_VALUES } from "@/lib/constants/notifications";
import { ADMIN_ROLES, ROLES } from "@/lib/constants/roles";
import { User } from "@/lib/db/models/User";
import { requireTenantId } from "@/lib/tenant/context";

const ADMIN_CACHE_TTL_MS = 60 * 1000;
/** Active admins per store, cached briefly. Keyed by tenant so stores never share recipients. */
const adminCache = new Map();

/** Notification audiences each staff level receives (mirrors lib/auth/permissions.js). */
const ROLE_AUDIENCES = {
  [ADMIN_ROLES.OWNER]: ADMIN_AUDIENCE_VALUES,
  [ADMIN_ROLES.MANAGER]: ADMIN_AUDIENCE_VALUES,
  [ADMIN_ROLES.STAFF]: [ADMIN_AUDIENCE.COMMERCE, ADMIN_AUDIENCE.SUPPORT, ADMIN_AUDIENCE.OPERATIONS],
};

/**
 * Audiences an admin may receive and read; both delivery targeting and the read APIs use this.
 * @param {{ adminRole?: string } | null | undefined} admin
 * @returns {string[]}
 */
export function allowedAdminAudiences(admin) {
  return ROLE_AUDIENCES[admin?.adminRole] ?? ROLE_AUDIENCES[ADMIN_ROLES.STAFF];
}

/**
 * Audience filter for read queries; null means "no restriction" so the query stays index-only.
 * @param {{ adminRole?: string } | null | undefined} admin
 */
export function adminAudienceFilter(admin) {
  const allowed = allowedAdminAudiences(admin);
  return allowed.length === ADMIN_AUDIENCE_VALUES.length ? null : allowed;
}

async function loadActiveAdmins() {
  const tenantId = requireTenantId();
  const cached = adminCache.get(tenantId);
  if (cached && Date.now() - cached.at < ADMIN_CACHE_TTL_MS) return cached.admins;
  const admins = await User.find({ role: ROLES.ADMIN, isActive: true }).select("_id email adminRole").lean();
  adminCache.set(tenantId, { at: Date.now(), admins });
  return admins;
}

export function resetAdminRecipientCache() {
  adminCache.clear();
}

/**
 * Admins of the current store who should receive a notification for `audience`.
 * @param {string} audience
 */
export async function resolveAdminRecipientIds(audience) {
  const admins = await loadActiveAdmins();
  return admins.filter((admin) => allowedAdminAudiences(admin).includes(audience)).map((admin) => admin._id);
}

/**
 * Maps the result of `requireAdminAccess()` to the admin's notification inbox.
 * @param {{ user: Record<string, any> }} access
 */
export function adminRecipientFromAccess(access) {
  return {
    recipient: { recipientType: "admin", recipientId: access.user._id },
    audiences: adminAudienceFilter(access.user),
  };
}
