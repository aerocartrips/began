import { DEFAULT_NOTIFICATION_PREFERENCES, SECURITY_EVENT_HISTORY } from "@/lib/constants/account";

const toIso = (value) => (value ? new Date(value).toISOString() : null);

/**
 * Accounts created before first/last name existed only have `name`; split it
 * on the first space for display and editing.
 * @param {{ name?: string; firstName?: string; lastName?: string }} user
 */
export function splitName(user) {
  if (user.firstName) return { firstName: user.firstName, lastName: user.lastName ?? "" };
  const [firstName = "", ...rest] = (user.name ?? "").trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

/**
 * Client-safe profile. Never includes password, tokens or session state.
 * @param {Record<string, any>} user
 */
export function toAccountProfile(user) {
  const verification = user.emailVerification ?? {};
  const pendingActive = Boolean(
    verification.pendingEmail && verification.expiresAt && new Date(verification.expiresAt) > new Date(),
  );
  return {
    id: String(user._id),
    name: user.name ?? "",
    ...splitName(user),
    email: user.email,
    isEmailVerified: Boolean(user.isEmailVerified),
    pendingEmail: pendingActive && verification.pendingEmail !== user.email ? verification.pendingEmail : "",
    pendingEmailExpiresAt: pendingActive ? toIso(verification.expiresAt) : null,
    phone: user.phone ?? "",
    companyName: user.companyName ?? "",
    gstNumber: user.gstNumber ?? "",
    avatarUrl: user.avatar?.url ?? "",
    createdAt: toIso(user.createdAt),
  };
}

/** @param {Record<string, any>} user */
export function toPreferences(user) {
  const stored = user.notificationPreferences ?? {};
  return {
    orderUpdates: stored.orderUpdates ?? DEFAULT_NOTIFICATION_PREFERENCES.orderUpdates,
    shippingUpdates: stored.shippingUpdates ?? DEFAULT_NOTIFICATION_PREFERENCES.shippingUpdates,
    promotional: stored.promotional ?? DEFAULT_NOTIFICATION_PREFERENCES.promotional,
    promotionalConsentAt: toIso(stored.promotionalConsentAt),
  };
}

/** @param {Record<string, any>} user */
export function toSecuritySummary(user) {
  return {
    isEmailVerified: Boolean(user.isEmailVerified),
    passwordChangedAt: toIso(user.passwordChangedAt),
    lastLoginAt: toIso(user.lastLoginAt),
    memberSince: toIso(user.createdAt),
  };
}

/** @param {Record<string, any>} user */
export function toDeletionRequest(user) {
  const request = user.deletionRequest ?? {};
  return {
    status: request.status ?? "none",
    requestedAt: toIso(request.requestedAt),
    reason: request.reason ?? "",
  };
}

/**
 * `$push` fragment that appends to the capped security activity log.
 * @param {string} type
 * @param {string} [ip]
 */
export function securityEventPush(type, ip = "") {
  return {
    securityEvents: {
      $each: [{ type, at: new Date(), ip: ip === "unknown" ? "" : ip }],
      $slice: -SECURITY_EVENT_HISTORY,
    },
  };
}

/** @param {{ type: string; at: Date; ip?: string }[] | undefined} events */
export function toSecurityEvents(events) {
  return (events ?? [])
    .map((event) => ({ type: event.type, at: toIso(event.at), ip: event.ip ?? "" }))
    .reverse();
}
