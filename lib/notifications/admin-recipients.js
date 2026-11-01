import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { ADMIN_AUDIENCE_VALUES } from "@/lib/constants/notifications";
import { ROLES } from "@/lib/constants/roles";
import { User } from "@/lib/db/models/User";

const ADMIN_CACHE_TTL_MS = 60 * 1000;
/** @type {{ at: number; admins: { _id: import("mongoose").Types.ObjectId; email: string }[] } | null} */
let adminCache = null;

/**
 * Env-configured dashboard admins (ADMIN_EMAIL) have no user document. They get a
 * stable recipient id derived from their email so they still have a personal inbox.
 * @param {string} email
 */
export function dashboardAdminRecipientId(email) {
  const hex = createHash("sha256").update(`norosilk-admin:${email.trim().toLowerCase()}`).digest("hex").slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

/**
 * Audiences an admin may receive and read. There is a single admin role today, so
 * every admin sees every audience; restrict here when finer-grained roles exist
 * (both delivery targeting and the read APIs go through this function).
 * @param {{ role?: string } | null | undefined} _admin
 * @returns {string[]}
 */
export function allowedAdminAudiences(_admin) {
  return ADMIN_AUDIENCE_VALUES;
}

/**
 * Audience filter for read queries; null means "no restriction" so the query stays index-only.
 * @param {{ role?: string } | null | undefined} admin
 */
export function adminAudienceFilter(admin) {
  const allowed = allowedAdminAudiences(admin);
  return allowed.length === ADMIN_AUDIENCE_VALUES.length ? null : allowed;
}

async function loadActiveAdmins() {
  if (adminCache && Date.now() - adminCache.at < ADMIN_CACHE_TTL_MS) return adminCache.admins;
  const admins = await User.find({ role: ROLES.ADMIN, isActive: true }).select("_id email role").lean();
  adminCache = { at: Date.now(), admins };
  return admins;
}

export function resetAdminRecipientCache() {
  adminCache = null;
}

/**
 * Admins who should receive a notification for `audience`.
 * @param {string} audience
 */
export async function resolveAdminRecipientIds(audience) {
  const admins = await loadActiveAdmins();
  const ids = admins.filter((admin) => allowedAdminAudiences(admin).includes(audience)).map((admin) => admin._id);

  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (envEmail && !admins.some((admin) => admin.email === envEmail)) {
    ids.push(dashboardAdminRecipientId(envEmail));
  }
  return ids;
}

/**
 * Maps the result of `requireAdminAccess()` to the admin's notification inbox.
 * @param {{ source: string; user: Record<string, any>; session?: { email: string } }} access
 */
export function adminRecipientFromAccess(access) {
  const recipientId = access.user?._id ?? dashboardAdminRecipientId(access.session?.email ?? access.user.email);
  return {
    recipient: { recipientType: "admin", recipientId },
    audiences: adminAudienceFilter(access.user),
  };
}
