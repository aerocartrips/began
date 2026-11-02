/** Placeholder so builds without a database (CI) still satisfy the `[domain]` root param. */
export const BUILD_PLACEHOLDER_DOMAIN = "build.invalid";

const HOSTNAME = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/**
 * Lower-cases a Host header and strips the port and trailing dot.
 * Returns null for anything that is not a plain hostname.
 * @param {string | null | undefined} host
 * @returns {string | null}
 */
export function normalizeHost(host) {
  if (!host) return null;
  const hostname = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return HOSTNAME.test(hostname) ? hostname : null;
}
