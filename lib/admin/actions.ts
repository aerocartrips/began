"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionMaxAge,
  createAdminSessionToken,
  getAdminSession,
  verifyAdminCredentials,
} from "@/lib/admin/auth";
import { getClientIpFromHeaders } from "@/lib/security/client-ip";
import { checkRateLimit, clearRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import type { AdminLoginState } from "@/features/auth/types/admin-login";

const LOGIN_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

export async function loginAdmin(
  _previousState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const allowShortPassword =
    process.env.NODE_ENV !== "production" && Boolean(process.env.ADMIN_PASSWORD);
  if (
    typeof emailValue !== "string" ||
    typeof passwordValue !== "string" ||
    emailValue.length > 254 ||
    passwordValue.length < (allowShortPassword ? 1 : 12) ||
    passwordValue.length > 1024
  ) {
    return { error: "Unable to sign in with those credentials." };
  }

  const email = emailValue.trim().toLowerCase();
  const requestHeaders = await headers();
  const address = getClientIpFromHeaders(requestHeaders);
  const rateLimitKeys = [`admin-login:ip:${address}`, `admin-login:email:${email}`];
  const rateLimits = await Promise.all(
    rateLimitKeys.map((key) => checkRateLimit(key, LOGIN_RATE_LIMIT)),
  );
  const blocked = rateLimits.some((rateLimit) => !rateLimit.allowed);
  if (blocked) {
    return { error: "Unable to sign in right now. Please wait and try again." };
  }

  let validCredentials = false;
  try {
    validCredentials = await verifyAdminCredentials(email, passwordValue);
  } catch {
    validCredentials = false;
  }

  if (!validCredentials) {
    await Promise.all(rateLimitKeys.map((key) => recordRateLimitHit(key, LOGIN_RATE_LIMIT)));
    return { error: "Unable to sign in with those credentials." };
  }

  await Promise.all(rateLimitKeys.map((key) => clearRateLimit(key)));
  let token: string;
  try {
    token = await createAdminSessionToken(email);
  } catch {
    return { error: "Admin sign-in is not configured. Contact the site operator." };
  }

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
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  (await cookies()).delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}