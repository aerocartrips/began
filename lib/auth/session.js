import { cookies } from "next/headers";
import { connection } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { ApiError } from "@/lib/utils/api-error";
import { User, toPublicUser } from "@/lib/db/models/User";
import { requireTenantId } from "@/lib/tenant/context";

export const ACCESS_COOKIE = "norosilk_access";
export const REFRESH_COOKIE = "norosilk_refresh";

const ACCESS_TTL_SECONDS = 60 * 15;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7;

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

async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, getAccessSecret(), {
    algorithms: ["HS256"],
    audience: requireTenantId(),
  });
  if (!payload.sub || typeof payload.sub !== "string") return null;
  return payload;
}

export async function getAuthUser() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  // Token expiry is checked against the current time, so this must run at request time.
  await connection();

  try {
    const payload = await verifyAccessToken(token);
    if (!payload) return null;
    const user = await User.findById(payload.sub).select("-password");
    if (!user || !user.isActive || !isCurrentSession(payload, user)) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireAuthUser() {
  const user = await getAuthUser();
  if (!user) {
    throw new ApiError(401, "Authentication required.");
  }
  return user;
}

export async function refreshSessionFromCookie() {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing.");
  }

  const secret = getRefreshSecret();
  const { payload } = await jwtVerify(refreshToken, secret, {
    algorithms: ["HS256"],
    audience: requireTenantId(),
  }).catch(() => {
    throw new ApiError(401, "Session expired. Please sign in again.");
  });

  if (payload.type !== "refresh" || !payload.sub) {
    throw new ApiError(401, "Invalid refresh token.");
  }

  const user = await User.findById(payload.sub).select("-password");
  if (!user || !user.isActive) {
    throw new ApiError(401, "User account unavailable.");
  }
  if (!isCurrentSession(payload, user)) {
    throw new ApiError(401, "Session has been revoked. Please sign in again.");
  }

  await setAuthCookies(user);
  return toPublicUser(user);
}

export { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS };
