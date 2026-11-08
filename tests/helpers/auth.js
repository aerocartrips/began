/**
 * Signs `user` in the way a browser would hold the session: store staff through
 * the admin session cookie (the only way staff are authenticated), customers
 * through the storefront access token. Call inside the user's tenant context.
 * @param {Map<string, string>} cookieJar the mocked `next/headers` cookie store
 * @param {{ role?: string } & Record<string, any>} user
 */
export async function signInto(cookieJar, user) {
  if (user.role === "admin") {
    const { ADMIN_SESSION_COOKIE, createAdminSessionToken } = await import("@/lib/admin/auth");
    cookieJar.set(ADMIN_SESSION_COOKIE, await createAdminSessionToken(user));
    return;
  }
  const { ACCESS_COOKIE, signAccessToken } = await import("@/lib/auth/session");
  cookieJar.set(ACCESS_COOKIE, await signAccessToken(user));
}
