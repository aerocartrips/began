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
import {
  clearLoginFailures,
  getLoginRateLimit,
  recordLoginFailure,
} from "@/lib/admin/login-rate-limit";
import type { AdminLoginState } from "@/features/auth/types/admin-login";

function getClientAddress(headerValue: string | null) {
  const candidate = headerValue?.split(",")[0]?.trim() ?? "unknown";
  return /^[\da-fA-F.:]{1,64}$/.test(candidate) ? candidate : "unknown";
}

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
  const address = getClientAddress(requestHeaders.get("x-real-ip"));
  const rateLimitKeys = [`ip:${address}`, `email:${email}`];
  const rateLimits = rateLimitKeys.map(getLoginRateLimit);
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
    rateLimitKeys.forEach(recordLoginFailure);
    return { error: "Unable to sign in with those credentials." };
  }

  rateLimitKeys.forEach(clearLoginFailures);
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