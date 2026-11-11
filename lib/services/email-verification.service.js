import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { User } from "@/lib/db/models/User";
import { ApiError } from "@/lib/utils/api-error";
import { logger } from "@/lib/utils/logger";
import { ACCOUNT_RATE_LIMITS, EMAIL_CODE, SECURITY_EVENT } from "@/lib/constants/account";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { securityEventPush } from "@/lib/services/account-dto";
import { sendEmailChangedNotice, sendEmailVerificationCode } from "@/lib/services/email.service";
import { emailCodeSchema, parseOrThrow } from "@/lib/validators/account.validator";

/**
 * Email verification by one-time code: on sign-up, on the sign-in of an
 * account that isn't verified yet, and when a customer changes their address.
 *
 * - One code is outstanding per account, for one address (`pendingEmail`).
 * - Only an HMAC of the code is stored, keyed with a server secret and bound to
 *   the account and address, so a copy of the database is no help in guessing it.
 * - Every guess uses up an attempt before it is compared, so parallel guesses
 *   can't exceed EMAIL_CODE.maxAttempts. A code works once.
 *
 * @typedef {{ email: string, expiresAt: string | null, resendAt: string, error?: string }} EmailCodeState
 *   What the code form shows. `error` is set when the code could not be sent.
 */

export const EMPTY_EMAIL_VERIFICATION = { pendingEmail: "", codeHash: "", expiresAt: null, attempts: 0, sentAt: null };

function codeDigest(userId, email, code) {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new ApiError(503, "Authentication is not configured. Set JWT_SECRET.");
  }
  return createHmac("sha256", secret).update(`email-code:${String(userId)}:${email}:${code}`).digest("hex");
}

const sameDigest = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const codeError = (message) => new ApiError(422, "Validation failed.", [{ field: "code", message }]);

/**
 * A usable code for `email` went out less than EMAIL_CODE.resendAfterMs ago.
 * One locked by wrong guesses doesn't count, so a new one can be sent at once.
 * @param {Record<string, any> | undefined} pending
 * @param {string} email
 * @param {number} now
 */
function isRecent(pending, email, now) {
  return (
    pending?.pendingEmail === email &&
    Boolean(pending.sentAt) &&
    now - new Date(pending.sentAt).getTime() < EMAIL_CODE.resendAfterMs &&
    new Date(pending.expiresAt).getTime() > now &&
    (pending.attempts ?? 0) < EMAIL_CODE.maxAttempts
  );
}

/** @returns {EmailCodeState} */
function toState(pending) {
  return {
    email: pending.pendingEmail,
    expiresAt: new Date(pending.expiresAt).toISOString(),
    resendAt: new Date(new Date(pending.sentAt).getTime() + EMAIL_CODE.resendAfterMs).toISOString(),
  };
}

/** A code for this address went out moments ago: hand back its state, or refuse a second email. */
function recentCode(pending, reuseRecent) {
  const state = toState(pending);
  if (reuseRecent) return state;
  const retryAfter = Math.max(1, Math.ceil((Date.parse(state.resendAt) - Date.now()) / 1000));
  const error = new ApiError(429, `We just sent a code to ${state.email}. You can ask for another in ${retryAfter} seconds.`);
  error.retryAfter = retryAfter;
  throw error;
}

/**
 * Emails a new code to `email` (the account's own address, or the one it is
 * changing to). A code for the same address sent less than
 * EMAIL_CODE.resendAfterMs ago is kept: with `reuseRecent` (sign-in and
 * sign-up, where a repeated submit is harmless) its state is returned,
 * otherwise the request gets a 429.
 * @param {{ _id: unknown, name: string, emailVerification?: Record<string, any> }} user
 * @param {string} email normalised address
 * @param {{ reuseRecent?: boolean, isChange?: boolean }} [options]
 * @returns {Promise<EmailCodeState>}
 */
export async function issueEmailCode(user, email, { reuseRecent = false, isChange = false } = {}) {
  const now = Date.now();
  if (isRecent(user.emailVerification, email, now)) return recentCode(user.emailVerification, reuseRecent);

  await consumeRateLimit(
    `email-code:${String(user._id)}`,
    ACCOUNT_RATE_LIMITS.emailCodeSend,
    "Too many codes requested for this account. Please try again later.",
  );

  const code = String(randomInt(0, 10 ** EMAIL_CODE.length)).padStart(EMAIL_CODE.length, "0");
  const sentAt = new Date(now);
  const expiresAt = new Date(now + EMAIL_CODE.ttlMs);
  const codeHash = codeDigest(user._id, email, code);
  // Written only if no code for this address went out in the meantime, so two requests at once send one email.
  const { matchedCount } = await User.updateOne(
    {
      _id: user._id,
      $nor: [
        {
          "emailVerification.pendingEmail": email,
          "emailVerification.sentAt": { $gt: new Date(now - EMAIL_CODE.resendAfterMs) },
          "emailVerification.expiresAt": { $gt: sentAt },
          "emailVerification.attempts": { $lt: EMAIL_CODE.maxAttempts },
        },
      ],
    },
    { $set: { emailVerification: { pendingEmail: email, codeHash, expiresAt, attempts: 0, sentAt } } },
  );
  if (!matchedCount) {
    const latest = await User.findById(user._id).select("emailVerification").lean();
    if (!isRecent(latest?.emailVerification, email, Date.now())) throw new ApiError(409, "Please try again.");
    return recentCode(latest.emailVerification, reuseRecent);
  }

  const delivery = await sendEmailVerificationCode({ to: email, name: user.name, code, minutes: EMAIL_CODE.ttlMs / 60_000, isChange });
  if (!delivery.sent) {
    // A code nobody received must not hold back the next request.
    await User.updateOne({ _id: user._id, "emailVerification.codeHash": codeHash }, { $set: { emailVerification: EMPTY_EMAIL_VERIFICATION } });
    logger.warn("Verification code email was not delivered", { reason: delivery.reason });
    throw new ApiError(502, "We couldn't send the code. Please try again in a moment.");
  }
  return toState({ pendingEmail: email, sentAt, expiresAt });
}

/**
 * Checks a code. The right one verifies the address it was sent to (it becomes
 * the account's email when it was a new one) and can't be used again.
 * @param {unknown} userId
 * @param {unknown} payload `{ code }`
 * @param {{ ip?: string, email?: string }} [options] `email`: only accept a code sent to this address
 * @returns {Promise<{ email: string, changed: boolean }>}
 */
export async function confirmEmailCode(userId, payload, { ip, email: expectedEmail } = {}) {
  const { code } = parseOrThrow(emailCodeSchema, payload);
  const expired = () => codeError("This code has expired. Request a new one.");

  const record = await User.findOneAndUpdate(
    {
      _id: userId,
      isActive: true,
      "emailVerification.codeHash": { $gt: "" },
      "emailVerification.expiresAt": { $gt: new Date() },
      "emailVerification.attempts": { $lt: EMAIL_CODE.maxAttempts },
      ...(expectedEmail ? { "emailVerification.pendingEmail": expectedEmail } : {}),
    },
    { $inc: { "emailVerification.attempts": 1 } },
    { returnDocument: "after" },
  )
    .select("name email +emailVerification.codeHash emailVerification.pendingEmail emailVerification.attempts")
    .lean();
  if (!record) throw expired();

  const pending = record.emailVerification;
  if (!sameDigest(codeDigest(userId, pending.pendingEmail, code), pending.codeHash)) {
    const left = EMAIL_CODE.maxAttempts - pending.attempts;
    throw codeError(
      left > 0 ? `That code isn't right. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "That code isn't right. Request a new one.",
    );
  }

  const previousEmail = record.email;
  const email = pending.pendingEmail;
  let updated;
  try {
    // Matched on the same code, so it is used once even when submitted twice at the same moment.
    updated = await User.findOneAndUpdate(
      { _id: userId, "emailVerification.codeHash": pending.codeHash },
      {
        $set: { email, isEmailVerified: true, emailVerification: EMPTY_EMAIL_VERIFICATION },
        $push: securityEventPush(SECURITY_EVENT.EMAIL_VERIFIED, ip),
      },
      { returnDocument: "after" },
    )
      .select("email")
      .lean();
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, "This email address is already in use by another account.");
    throw error;
  }
  if (!updated) throw expired();

  const changed = previousEmail !== email;
  if (changed) {
    await sendEmailChangedNotice({ to: previousEmail, name: record.name, newEmail: email }).catch((error) =>
      logger.warn("Email change notice failed", { error, userId: String(userId) }),
    );
  }
  return { email: updated.email, changed };
}
