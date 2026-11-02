import "server-only";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { ROLES } from "@/lib/constants/roles";
import { permissionsForRole, roleHasPermission } from "@/lib/auth/permissions";
import { requireTenantId } from "@/lib/tenant/context";

export const ADMIN_SESSION_COOKIE = "norosilk-admin-session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 8;
const ISSUER = "norosilk-admin";

export type AdminSession = {
  userId: string;
  email: string;
  name: string;
  adminRole: string;
  permissions: string[];
};

// Compared against when the email is unknown, so response time does not reveal which admins exist.
const DUMMY_HASH = "$2b$12$.f1Xdk2He.Br0HHwaiO1PO6mWaUmBKpLtKl5fq1B9yVnxjUPMYLxS";

function getSigningKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

function sessionVersionOf(user: { sessionVersion?: number }) {
  return Number.isInteger(user.sessionVersion) ? Number(user.sessionVersion) : 0;
}

/** Store admin with this email and password in the current tenant, or null. */
export async function verifyAdminCredentials(email: string, password: string) {
  await connectDB();
  const admin = await User.findOne({ email: email.trim().toLowerCase(), role: ROLES.ADMIN, isActive: true })
    .select("+password")
    .lean<{ _id: unknown; password?: string; sessionVersion?: number }>();
  const matches = await bcrypt.compare(password, admin?.password ?? DUMMY_HASH);
  return admin && matches ? admin : null;
}

export async function createAdminSessionToken(admin: { _id: unknown; sessionVersion?: number }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: ROLES.ADMIN, sv: sessionVersionOf(admin) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(requireTenantId())
    .setSubject(String(admin._id))
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_LIFETIME_SECONDS)
    .sign(getSigningKey());
}

/**
 * Admin signed in to the current store. Requires a tenant context; the token's
 * audience must match it and the user must still be an active admin whose
 * session version (bumped on password change / sign-out everywhere) matches.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: requireTenantId(),
      maxTokenAge: SESSION_LIFETIME_SECONDS,
    });
    if (payload.role !== ROLES.ADMIN || !payload.sub) return null;

    await connectDB();
    const admin = await User.findOne({ _id: payload.sub, role: ROLES.ADMIN, isActive: true })
      .select("email name adminRole sessionVersion")
      .lean<{ _id: unknown; email: string; name: string; adminRole: string; sessionVersion?: number }>();
    if (!admin) return null;
    const claimedVersion = Number.isInteger(payload.sv) ? Number(payload.sv) : 0;
    if (claimedVersion !== sessionVersionOf(admin)) return null;

    return {
      userId: String(admin._id),
      email: admin.email,
      name: admin.name,
      adminRole: admin.adminRole,
      permissions: permissionsForRole(admin.adminRole),
    };
  } catch {
    return null;
  }
}

/**
 * For admin pages: redirects to sign-in without a session and renders the
 * 403 page when the admin's role lacks `permission`.
 */
export async function requireAdmin(permission?: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (permission && !roleHasPermission(session.adminRole, permission)) forbidden();
  return session;
}

export const adminSessionMaxAge = SESSION_LIFETIME_SECONDS;
