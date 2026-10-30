import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

export const ADMIN_SESSION_COOKIE = "neov-admin-session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 8;

export type AdminSession = {
  email: string;
};

function getSigningKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

function safeEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export async function verifyAdminCredentials(email: string, password: string) {
  const { verifyDatabaseAdminCredentials } = await import("@/lib/services/admin-auth.service");
  const databaseAdmin = await verifyDatabaseAdminCredentials(email, password).catch(() => null);
  if (databaseAdmin) return true;

  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const plainPassword =
    process.env.NODE_ENV !== "production" ? process.env.ADMIN_PASSWORD : undefined;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const hashCost = passwordHash?.match(/^\$2[aby]\$(\d{2})\$/)?.[1];

  if (!configuredEmail) return false;

  const emailMatches = safeEqual(email.trim().toLowerCase(), configuredEmail);
  if (plainPassword) return emailMatches && safeEqual(password, plainPassword);
  if (!passwordHash || !hashCost || Number(hashCost) < 12) return false;

  const passwordMatches = await bcrypt.compare(password, passwordHash);
  return emailMatches && passwordMatches;
}

export async function createAdminSessionToken(email: string) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: "admin", email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("neovastra-admin")
    .setAudience("neovastra-admin-dashboard")
    .setSubject("admin")
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_LIFETIME_SECONDS)
    .sign(getSigningKey());
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ["HS256"],
      issuer: "neovastra-admin",
      audience: "neovastra-admin-dashboard",
      maxTokenAge: SESSION_LIFETIME_SECONDS,
    });
    if (
      payload.sub !== "admin" ||
      payload.role !== "admin" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (configuredEmail && safeEqual(payload.email.toLowerCase(), configuredEmail)) {
      return { email: payload.email };
    }

    const { verifyDatabaseAdminSessionEmail } = await import("@/lib/services/admin-auth.service");
    const databaseSession = await verifyDatabaseAdminSessionEmail(payload.email).catch(() => null);
    if (databaseSession) return databaseSession;

    return null;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export const adminSessionMaxAge = SESSION_LIFETIME_SECONDS;