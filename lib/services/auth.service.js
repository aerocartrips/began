import { ApiError } from "@/lib/utils/api-error";
import { BCRYPT_ROUNDS, hashPassword, verifyPassword } from "@/lib/auth/password";
import { ROLES } from "@/lib/constants/roles";
import { toPublicUser } from "@/lib/db/models/User";
import { userRepository } from "@/lib/repositories/user.repository";
import {
  clearAuthCookies,
  clearEmailVerificationCookie,
  getEmailVerificationUser,
  setAuthCookies,
  setEmailVerificationCookie,
} from "@/lib/auth/session";
import { isCustomerEmailConfigured } from "@/lib/services/email.service";
import { confirmEmailCode, issueEmailCode } from "@/lib/services/email-verification.service";
import { registerSchema, loginSchema, formatZodErrors } from "@/lib/validators/auth.validator";

export { BCRYPT_ROUNDS };

/**
 * @typedef {import("@/lib/services/email-verification.service").EmailCodeState} EmailCodeState
 * @typedef {{ user: Record<string, any> } | { verification: EmailCodeState }} SignInResult
 *   `user`: signed in. `verification`: a code was emailed; the session opens
 *   once it is entered (completeEmailVerification).
 */

const VERIFICATION_EXPIRED = "Your sign-in timed out. Sign in again to get a new code.";

async function openSession(user) {
  user.lastLoginAt = new Date();
  await Promise.all([setAuthCookies(user), userRepository.touchLastLogin(user._id, user.lastLoginAt)]);
  return { user: toPublicUser(user) };
}

/**
 * Signs `user` in, unless their email isn't verified yet: then a code is
 * emailed and the session waits for it (only verified addresses get sessions,
 * see isUsableCustomer). Without email delivery nobody could verify, so the
 * session opens directly.
 * @returns {Promise<SignInResult>}
 */
async function startSession(user) {
  if (user.isEmailVerified || !isCustomerEmailConfigured()) return openSession(user);

  const [verification] = await Promise.all([sendSignInCode(user), setEmailVerificationCookie(user)]);
  return { verification };
}

/**
 * The password step already succeeded, so the code form opens even when the
 * email can't go out right now: it shows why and when to ask for another.
 * @returns {Promise<EmailCodeState>}
 */
async function sendSignInCode(user) {
  try {
    return await issueEmailCode(user, user.email, { reuseRecent: true });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const retryAfterMs = (Number.isFinite(error.retryAfter) ? error.retryAfter : 0) * 1000;
    return { email: user.email, expiresAt: null, resendAt: new Date(Date.now() + retryAfterMs).toISOString(), error: error.message };
  }
}

/** @returns {Promise<SignInResult>} */
export async function registerUser(payload) {
  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const existing = await userRepository.findByEmail(parsed.data.email);
  if (existing) {
    throw new ApiError(409, "An account with this email already exists.", [
      { field: "email", message: "This email is already registered. Sign in instead, or reset your password." },
    ]);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [firstName, ...rest] = parsed.data.name.split(/\s+/);
  const user = await userRepository.create({
    name: parsed.data.name,
    firstName,
    lastName: rest.join(" "),
    email: parsed.data.email.toLowerCase(),
    password: passwordHash,
    phone: parsed.data.phone || "",
    companyName: parsed.data.companyName || "",
    gstNumber: parsed.data.gstNumber || "",
    role: ROLES.CUSTOMER,
  });

  return startSession(user);
}

/** @returns {Promise<SignInResult>} */
export async function loginUser(payload) {
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  // Storefront sign-in is for customers; staff use the admin sign-in. Any other
  // account gets the same answer, in the same time, as a wrong password.
  const user = await userRepository.findCustomerByEmail(parsed.data.email);
  const passwordMatches = await verifyPassword(parsed.data.password, user?.isActive ? user.password : null);
  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  return startSession(user);
}

/**
 * Finishes a sign-in that was waiting for its emailed code: the cookie from
 * the password step plus the right code open the session.
 * @param {unknown} payload `{ code }`
 * @param {string} [ip]
 */
export async function completeEmailVerification(payload, ip) {
  const user = await getEmailVerificationUser();
  if (!user) throw new ApiError(401, VERIFICATION_EXPIRED);
  // Verified meanwhile (another tab, a password reset): the password step is enough now.
  if (!user.isEmailVerified) {
    await confirmEmailCode(user._id, payload, { ip, email: user.email });
    user.isEmailVerified = true;
  }
  const [result] = await Promise.all([openSession(user), clearEmailVerificationCookie()]);
  return result;
}

/** Emails a new code for the sign-in waiting in this browser. */
export async function resendEmailVerification() {
  const user = await getEmailVerificationUser();
  if (!user) throw new ApiError(401, VERIFICATION_EXPIRED);
  if (user.isEmailVerified) throw new ApiError(409, "Your email is already verified. Sign in again to continue.");
  return issueEmailCode(user, user.email);
}

export async function logoutUser() {
  await clearAuthCookies();
}

export async function getCurrentUser(user) {
  return toPublicUser(user);
}
