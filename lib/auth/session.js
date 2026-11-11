import { cookies } from "next/headers";
import { connection } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { ApiError } from "@/lib/utils/api-error";
import { User, toPublicUser } from "@/lib/db/models/User";
import { requireTenantId } from "@/lib/tenant/context";
import { ROLES } from "@/lib/constants/roles";
import { isCustomerEmailConfigured } from "@/lib/services/email.service";
import { ACCESS_COOKIE, EMAIL_VERIFICATION_COOKIE, REFRESH_COOKIE, SESSION_EXPIRED_CODE } from "@/lib/auth/cookies";

export { ACCESS_COOKIE, REFRESH_COOKIE };

const ACCESS_TTL_SECONDS = 60 * 15;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7;
/** Time to enter the emailed code (and ask for new ones) after the password step. */
const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 30;
/** Only the auth API reads the sign-in-in-progress cookie, so browsers send it nowhere else. */
const EMAIL_VERIFICATION_COOKIE_PATH = "/api/v1/auth";
const EMAIL_VERIFICATION_TOKEN = "email_verification";

function getAccessSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new ApiError(503, "Authentication is not configured. Set JWT_SECRET.");
  }
  return new TextEncoder().encode(secret);
}

function getRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new ApiError(503, "Authentication is not configured. Set JWT_REFRESH_SECRET.");
  }
  return new TextEncoder().encode(secret);
}

export function getAuthCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

/** Tokens issued before session versioning carry no `sv` claim and map to version 0. */
function sessionVersionOf(user) {
  return Number.isInteger(user?.sessionVersion) ? user.sessionVersion : 0;
}

/** Active customer account. Staff sign in through the admin sign-in, never here. */
function isCustomerAccount(user) {
  return Boolean(user?.isActive) && user.role === ROLES.CUSTOMER;
}

/**
 * Storefront sessions belong to active customers whose email is verified.
 * Staff sign in through the admin sign-in (stricter cookie, per-account rate
 * limits), so a staff account can't be used, or have its password tried, on
 * the storefront. Unverified accounts get a session only once they enter the
 * emailed code (auth.service.js), and a session issued earlier stops working;
 * without email delivery nobody could verify, so the check is skipped then.
 */
function isUsableCustomer(user) {
  return isCustomerAccount(user) && (Boolean(user.isEmailVerified) || !isCustomerEmailConfigured());
}

function isCurrentSession(payload, user) {
  const claimed = Number.isInteger(payload.sv) ? payload.sv : 0;
  return claimed === sessionVersionOf(user);
}

export async function signAccessToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: user.role, email: user.email, sv: sessionVersionOf(user) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user._id))
    // Tokens are bound to the store that issues them.
    .setAudience(requireTenantId())
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL_SECONDS)
    .sign(getAccessSecret());
}

export async function signRefreshToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ type: "refresh", role: user.role, sv: sessionVersionOf(user) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user._id))
    // Tokens are bound to the store that issues them.
    .setAudience(requireTenantId())
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TTL_SECONDS)
    .sign(getRefreshSecret());
}

export async function setAuthCookies(user) {
  const cookieStore = await cookies();
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user),
    signRefreshToken(user),
  ]);
  cookieStore.set(ACCESS_COOKIE, accessToken, getAuthCookieOptions(ACCESS_TTL_SECONDS));
  cookieStore.set(REFRESH_COOKIE, refreshToken, getAuthCookieOptions(REFRESH_TTL_SECONDS));
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, "", { ...getAuthCookieOptions(0), maxAge: 0 });
  cookieStore.set(REFRESH_COOKIE, "", { ...getAuthCookieOptions(0), maxAge: 0 });
}

/**
 * Marks this browser as part-way through signing in: the password step (or
 * registration) is done, the emailed code isn't. Signed with the refresh
 * secret under its own `type`, so it can't stand in for an access or refresh
 * token (and they can't stand in for it). Carries `sv`, so a password reset
 * or "sign out everywhere" cancels it.
 */
export async function setEmailVerificationCookie(user) {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ type: EMAIL_VERIFICATION_TOKEN, sv: sessionVersionOf(user) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user._id))
    .setAudience(requireTenantId())
    .setIssuedAt(now)
    .setExpirationTime(now + EMAIL_VERIFICATION_TTL_SECONDS)
    .sign(getRefreshSecret());
  (await cookies()).set(EMAIL_VERIFICATION_COOKIE, token, {
    ...getAuthCookieOptions(EMAIL_VERIFICATION_TTL_SECONDS),
    path: EMAIL_VERIFICATION_COOKIE_PATH,
  });
}

export async function clearEmailVerificationCookie() {
  (await cookies()).set(EMAIL_VERIFICATION_COOKIE, "", { ...getAuthCookieOptions(0), path: EMAIL_VERIFICATION_COOKIE_PATH });
}

/**
 * The account waiting for its emailed code in this browser, or null when there
 * is none (no cookie, expired, another store's, or the session version moved on).
 */
export async function getEmailVerificationUser() {
  const token = (await cookies()).get(EMAIL_VERIFICATION_COOKIE)?.value;
  if (!token) return null;
  const secret = getRefreshSecret();
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"], audience: requireTenantId() });
    if (payload.type !== EMAIL_VERIFICATION_TOKEN || typeof payload.sub !== "string") return null;
    const user = await User.findById(payload.sub).select("-password");
    return isCustomerAccount(user) && isCurrentSession(payload, user) ? user : null;
  } catch {
    return null;
  }
}

async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, getAccessSecret(), {
    algorithms: ["HS256"],
    audience: requireTenantId(),
  });
  if (!payload.sub || typeof payload.sub !== "string") return null;
  return payload;
}

/** @param {Uint8Array} [secret] */
async function verifyRefreshToken(token, secret = getRefreshSecret()) {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
    audience: requireTenantId(),
  });
  if (payload.type !== "refresh" || !payload.sub || typeof payload.sub !== "string") return null;
  return payload;
}

/**
 * The user a token was issued to, if the token verifies and its session is
 * still current (active account, unrevoked session version).
 * @param {string} token
 * @param {(token: string) => Promise<import("jose").JWTPayload | null>} verify
 */
async function userForToken(token, verify) {
  try {
    const payload = await verify(token);
    if (!payload) return null;
    const user = await User.findById(payload.sub).select("-password");
    return isUsableCustomer(user) && isCurrentSession(payload, user) ? user : null;
  } catch {
    return null;
  }
}

/** Signed-in user for API routes and Server Actions: the access token only. */
export async function getAuthUser() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  // Token expiry is checked against the current time, so this must run at request time.
  await connection();
  return userForToken(token, verifyAccessToken);
}

/**
 * 401 for a request without a usable access token. When a refresh cookie is
 * present the error carries `code: "session_expired"`, telling the browser that
 * one call to /auth/refresh can recover the session. Plain 401s (signed-out
 * visitors) don't send it, so they cost no extra request.
 */
export async function authenticationRequired(message = "Authentication required.") {
  const renewable = Boolean((await cookies()).get(REFRESH_COOKIE)?.value);
  return new ApiError(401, message, [], renewable ? { code: SESSION_EXPIRED_CODE } : {});
}

export async function requireAuthUser() {
  const user = await getAuthUser();
  if (!user) throw await authenticationRequired();
  return user;
}

/**
 * @typedef {"anonymous" | "active" | "renewable" | "invalid"} SessionStatus
 * - anonymous: no auth cookies.
 * - active: the access token is valid.
 * - renewable: the access token is missing or expired, the refresh token is valid.
 * - invalid: auth cookies are present but expired, revoked or unusable.
 */

/**
 * Session for Server Components, which cannot write cookies. Access tokens
 * live 15 minutes, so a page rendered after that falls back to the refresh
 * token, checked exactly as /auth/refresh checks it (signature, store, account
 * status, session version). Pages therefore stay signed in for the whole
 * session; the browser renews its tokens on its next API call or through
 * /auth/user-check.
 * @returns {Promise<{ user: any, status: SessionStatus }>} `user`: the User document (as getAuthUser returns it), or null
 */
export async function readSession() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!accessToken && !refreshToken) return { user: null, status: "anonymous" };
  await connection();

  const activeUser = accessToken ? await userForToken(accessToken, verifyAccessToken) : null;
  if (activeUser) return { user: activeUser, status: "active" };
  const renewableUser = refreshToken ? await userForToken(refreshToken, verifyRefreshToken) : null;
  if (renewableUser) return { user: renewableUser, status: "renewable" };
  return { user: null, status: "invalid" };
}

/**
 * Brings the auth cookies in line with the session (Route Handlers only, as
 * they can write cookies): a renewable session gets fresh tokens, and cookies
 * that no longer belong to a session are cleared.
 */
export async function reconcileSession() {
  const session = await readSession();
  if (session.status === "renewable") await setAuthCookies(session.user);
  else if (session.status === "invalid") await clearAuthCookies();
  return session;
}

export async function refreshSessionFromCookie() {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing.");
  }

  const secret = getRefreshSecret();
  const payload = await verifyRefreshToken(refreshToken, secret).catch(() => {
    throw new ApiError(401, "Session expired. Please sign in again.");
  });
  if (!payload) {
    throw new ApiError(401, "Invalid refresh token.");
  }

  const user = await User.findById(payload.sub).select("-password");
  if (!isUsableCustomer(user)) {
    throw new ApiError(401, "User account unavailable.");
  }
  if (!isCurrentSession(payload, user)) {
    throw new ApiError(401, "Session has been revoked. Please sign in again.");
  }

  await setAuthCookies(user);
  return toPublicUser(user);
}

export { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS };
