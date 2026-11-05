/**
 * Auth cookie names, shared by the session layer and proxy.ts.
 * Keep this module free of imports: the proxy bundles it.
 */
export const ACCESS_COOKIE = "norosilk_access";
export const REFRESH_COOKIE = "norosilk_refresh";

/** `code` on a 401 whose access token expired while a refresh cookie is still present. */
export const SESSION_EXPIRED_CODE = "session_expired";
