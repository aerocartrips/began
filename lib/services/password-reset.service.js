import { createHash, randomBytes } from "node:crypto";
import { User } from "@/lib/db/models/User";
import { ApiError } from "@/lib/utils/api-error";
import { logger } from "@/lib/utils/logger";
import { ROLES } from "@/lib/constants/roles";
import { PASSWORD_RESET_TTL_MS, SECURITY_EVENT } from "@/lib/constants/account";
import { hashPassword } from "@/lib/auth/password";
import { clearRateLimit } from "@/lib/security/rate-limit";
import { securityEventPush } from "@/lib/services/account-dto";
import { isCustomerEmailConfigured, sendPasswordResetEmail } from "@/lib/services/email.service";
import { forgotPasswordSchema, parseOrThrow, resetPasswordSchema } from "@/lib/validators/account.validator";
import { getStoreOrigin } from "@/lib/tenant/active";

/**
 * "Forgot password" for storefront customers, modelled on email verification:
 * a random single-use token is emailed, only its SHA-256 hash is stored, and it
 * expires after 30 minutes. Staff reset passwords through the store owner.
 */

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const EMPTY_RESET = { tokenHash: "", expiresAt: null };

/**
 * Emails a reset link when the address belongs to an active customer. The
 * caller answers the same way whether or not it does, so the page can't be
 * used to find out who has an account.
 * @param {unknown} payload
 * @returns {Promise<{ email: string }>}
 */
export async function requestPasswordReset(payload) {
  const { email } = parseOrThrow(forgotPasswordSchema, payload);
  if (!isCustomerEmailConfigured()) {
    throw new ApiError(503, "Password reset by email is unavailable right now. Contact us and we'll help you sign in.");
  }

  const user = await User.findOne({ email, role: ROLES.CUSTOMER, isActive: true }).select("name email").lean();
  if (!user) return { email };

  const token = randomBytes(32).toString("base64url");
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordReset: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) } } },
  );
  const resetUrl = `${await getStoreOrigin()}/account/reset-password?token=${token}`;
  const delivery = await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
  if (!delivery.sent) logger.warn("Password reset email was not delivered", { reason: delivery.reason });
  return { email };
}

/**
 * Sets a new password from an emailed link. The link works once; every
 * signed-in session is ended (the session version is bumped), and the email
 * address counts as verified since the link reached it.
 * @param {unknown} payload
 * @param {string} [ip]
 */
export async function resetPassword(payload, ip) {
  const { token, newPassword } = parseOrThrow(resetPasswordSchema, payload);
  const tokenHash = hashToken(token);
  const invalid = () => new ApiError(400, "This reset link is invalid or has expired. Request a new one.");

  const user = await User.findOne({
    "passwordReset.tokenHash": tokenHash,
    "passwordReset.expiresAt": { $gt: new Date() },
    role: ROLES.CUSTOMER,
    isActive: true,
  })
    .select("email")
    .lean();
  if (!user) throw invalid();

  const localPart = user.email.split("@")[0].toLowerCase();
  if (localPart.length >= 4 && newPassword.toLowerCase().includes(localPart)) {
    throw new ApiError(422, "Validation failed.", [
      { field: "newPassword", message: "Avoid using your email address in your password." },
    ]);
  }

  const password = await hashPassword(newPassword);
  // Matching the token again makes the link single-use even under concurrent submits.
  const updated = await User.findOneAndUpdate(
    { _id: user._id, "passwordReset.tokenHash": tokenHash },
    {
      $set: { password, passwordChangedAt: new Date(), passwordReset: EMPTY_RESET, isEmailVerified: true },
      $inc: { sessionVersion: 1 },
      $push: securityEventPush(SECURITY_EVENT.PASSWORD_RESET, ip),
    },
    { returnDocument: "after" },
  )
    .select("email")
    .lean();
  if (!updated) throw invalid();

  // Failed sign-ins before the reset no longer hold the account back.
  await clearRateLimit(`login:account:${updated.email}`);
  return { email: updated.email };
}
