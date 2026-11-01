const IP_PATTERN = /^[\da-fA-F.:]{1,64}$/;

/**
 * Best-effort client address. Relies on the hosting proxy (Vercel, Nginx, etc.)
 * overwriting `x-real-ip` / `x-forwarded-for`; when self-hosting without a proxy
 * these headers are client-controlled.
 * @param {Headers} headers
 */
export function getClientIpFromHeaders(headers) {
  const forwarded = headers.get("x-real-ip") ?? headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return IP_PATTERN.test(candidate) ? candidate : "unknown";
}

/**
 * @param {Request} request
 */
export function getClientIp(request) {
  return getClientIpFromHeaders(request.headers);
}
