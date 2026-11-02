"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionMaxAge,
  createAdminSessionToken,
  verifyAdminCredentials,
} from "@/lib/admin/auth";
import { getClientIpFromHeaders } from "@/lib/security/client-ip";
import { checkRateLimit, clearRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { runWithTenant } from "@/lib/tenant/context";
import { getActionTenant } from "@/lib/tenant/current";
import type { AdminLoginState } from "@/features/auth/types/admin-login";

const LOGIN_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const GENERIC_ERROR = "Unable to sign in with those credentials.";

export async function loginAdmin(
  _previousState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  if (
    typeof emailValue !== "string" ||
    typeof passwordValue !== "string" ||
    emailValue.length > 254 ||
    passwordValue.length < 1 ||
    passwordValue.length > 1024
  ) {
    return { error: GENERIC_ERROR };
  }

  const tenant = await getActionTenant();
  const email = emailValue.trim().toLowerCase();
  const address = getClientIpFromHeaders(await headers());
  // Keys include the store so a lockout on one store does not affect another.
  const rateLimitKeys = [`admin-login:${tenant.id}:ip:${address}`, `admin-login:${tenant.id}:email:${email}`];
  const rateLimits = await Promise.all(rateLimitKeys.map((key) => checkRateLimit(key, LOGIN_RATE_LIMIT)));
  if (rateLimits.some((rateLimit) => !rateLimit.allowed)) {
    return { error: "Unable to sign in right now. Please wait and try again." };
  }

  const token = await runWithTenant(tenant, async () => {
    const admin = await verifyAdminCredentials(email, passwordValue).catch(() => null);
    return admin ? createAdminSessionToken(admin) : null;
  });

  if (!token) {
    await Promise.all(rateLimitKeys.map((key) => recordRateLimitHit(key, LOGIN_RATE_LIMIT)));
    return { error: GENERIC_ERROR };
  }
  await Promise.all(rateLimitKeys.map((key) => clearRateLimit(key)));

  (await cookies()).set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: adminSessionMaxAge,
  });

  redirect("/admin");
}

export async function logoutAdmin() {
  (await cookies()).delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
