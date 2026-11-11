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

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Development hosts: localhost, *.localhost and IPv4 addresses (e.g. a phone
 * on the same network). They are served over plain http on the dev server's port.
 * @param {string} hostname normalised hostname
 */
export function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname.endsWith(".localhost") || IPV4.test(hostname);
}

/**
 * Absolute origin of a store domain: https on the default port for real
 * domains; http, with `port` when given, for development hosts.
 * @param {string} hostname normalised hostname
 * @param {string | number} [port] used for development hosts only
 */
export function storeOriginFor(hostname, port) {
  if (!isLocalHostname(hostname)) return `https://${hostname}`;
  return `http://${hostname}${port ? `:${port}` : ""}`;
}

/**
 * Origin a request came in on, from its Host header, or null when the header
 * is malformed. Only use it once the host has resolved to a store: that lookup
 * is what makes it one of the store's own domains rather than whatever a
 * client sent (a forged Host never reaches a store, so it never reaches a link).
 * @param {string | null | undefined} host
 */
export function requestOrigin(host) {
  const hostname = normalizeHost(host);
  if (!hostname) return null;
  return storeOriginFor(hostname, /:(\d{1,5})$/.exec(host.trim())?.[1]);
}
