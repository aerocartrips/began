import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "@/lib/db/models/User";
import { Order } from "@/lib/db/models/Order";
import { Cart } from "@/lib/db/models/Cart";
import { Wishlist } from "@/lib/db/models/Wishlist";
import { Notification } from "@/lib/db/models/Notification";
import { StockAlert } from "@/lib/db/models/StockAlert";
import { ApiError } from "@/lib/utils/api-error";
import { logger } from "@/lib/utils/logger";
import { ROLES } from "@/lib/constants/roles";
import { ORDER_STATUS, RETURN_REQUEST_STATUS } from "@/lib/constants/order-status";
import { ACCOUNT_RATE_LIMITS, DELETION_REQUEST_STATUS, SECURITY_EVENT } from "@/lib/constants/account";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/session";
import { BCRYPT_ROUNDS } from "@/lib/auth/password";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { isCustomerEmailConfigured } from "@/lib/services/email.service";
import { EMPTY_EMAIL_VERIFICATION, issueEmailCode } from "@/lib/services/email-verification.service";
import { deleteCloudinaryImage } from "@/lib/cloudinary/delete";
import {
  changePasswordSchema,
  deletionRequestSchema,
  emailChangeSchema,
  parseOrThrow,
} from "@/lib/validators/account.validator";
import { securityEventPush, toDeletionRequest, toSecurityEvents, toSecuritySummary } from "@/lib/services/account-dto";

/**
 * @param {unknown} userId
 * @param {string} password
 * @param {string} [field]
 */
async function assertPassword(userId, password, field = "currentPassword") {
  const record = await User.findById(userId).select("+password");
  const matches = record ? await bcrypt.compare(password, record.password) : false;
  if (!matches) {
    throw new ApiError(422, "Validation failed.", [{ field, message: "Your current password is incorrect." }]);
  }
  return record;
}

export async function getSecurityOverview(user) {
  const record = await User.findById(user._id).select("+securityEvents createdAt").lean();
  return {
    ...toSecuritySummary(user),
    activity: toSecurityEvents(record?.securityEvents),
  };
}

export async function changePassword(user, payload, ip) {
  const data = parseOrThrow(changePasswordSchema, payload);
  const record = await assertPassword(user._id, data.currentPassword);

  const localPart = record.email.split("@")[0].toLowerCase();
  if (localPart.length >= 4 && data.newPassword.toLowerCase().includes(localPart)) {
    throw new ApiError(422, "Validation failed.", [
      { field: "newPassword", message: "Avoid using your email address in your password." },
    ]);
  }

  const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);
  const changedAt = new Date();
  // Matching on the previous hash makes concurrent changes fail instead of silently overwriting.
  const updated = await User.findOneAndUpdate(
    { _id: user._id, password: record.password },
    {
      $set: { password: passwordHash, passwordChangedAt: changedAt },
      $inc: { sessionVersion: 1 },
      $push: securityEventPush(SECURITY_EVENT.PASSWORD_CHANGED, ip),
    },
    { returnDocument: "after" },
  ).select("_id role email sessionVersion");
  if (!updated) {
    throw new ApiError(409, "Your password was changed in another session. Sign in again to continue.");
  }

  // Other devices are signed out by the version bump; this one gets fresh tokens.
  await setAuthCookies(updated);
  return { passwordChangedAt: changedAt.toISOString() };
}

export async function revokeAllSessions(user, ip) {
  await User.updateOne(
    { _id: user._id },
    { $inc: { sessionVersion: 1 }, $push: securityEventPush(SECURITY_EVENT.SESSIONS_REVOKED, ip) },
  );
  await clearAuthCookies();
}

/**
 * Starts an email change: emails a code to the new address (after checking the
 * current password). The account's email only changes once the code is
 * entered (confirmEmailCode). Asking again for the same address is how the
 * code form resends: while the change's code is valid that needs no password,
 * since the change was already approved. (The current address needs no
 * verifying here: signed-in customers verified it before their session opened.)
 * @param {{ ip?: string }} context
 */
export async function requestEmailVerification(user, payload, context = {}) {
  const { email, currentPassword } = parseOrThrow(emailChangeSchema, payload);
  if (!isCustomerEmailConfigured()) {
    throw new ApiError(503, "Email verification is unavailable right now. Contact support to update your email.");
  }
  if (email === user.email) {
    throw new ApiError(422, "Validation failed.", [{ field: "email", message: "This is already your email address." }]);
  }

  const pending = user.emailVerification;
  const isResend = pending?.pendingEmail === email && new Date(pending.expiresAt) > new Date();
  if (!isResend) {
    if (!currentPassword) {
      throw new ApiError(422, "Validation failed.", [
        { field: "currentPassword", message: "Enter your current password to change your email." },
      ]);
    }
    // Counted before the password check, so this form can't be used to guess the password.
    await consumeRateLimit(
      `account:email-change:${String(user._id)}`,
      ACCOUNT_RATE_LIMITS.emailChange,
      "Too many email change attempts. Please try again later.",
    );
    await assertPassword(user._id, currentPassword);
    if (await User.exists({ email, _id: { $ne: user._id } })) {
      throw new ApiError(409, "Validation failed.", [{ field: "email", message: "This email address is already in use." }]);
    }
  }

  // A repeat request within the resend cooldown returns the code already on its way instead of failing.
  const verification = await issueEmailCode(user, email, { isChange: true, reuseRecent: true });
  if (!isResend) {
    await User.updateOne({ _id: user._id }, { $push: securityEventPush(SECURITY_EVENT.EMAIL_CHANGE_REQUESTED, context.ip) });
  }
  return { ...verification, pendingEmail: email };
}

export async function cancelEmailChange(user) {
  await User.updateOne({ _id: user._id }, { $set: { emailVerification: EMPTY_EMAIL_VERIFICATION } });
}

export async function requestAccountDeletion(user, payload, ip) {
  if (user.role !== ROLES.CUSTOMER) {
    throw new ApiError(403, "Only customer accounts can request deletion here.");
  }
  const { currentPassword, reason } = parseOrThrow(deletionRequestSchema, payload);
  await assertPassword(user._id, currentPassword);

  const updated = await User.findOneAndUpdate(
    { _id: user._id, "deletionRequest.status": { $ne: DELETION_REQUEST_STATUS.PENDING } },
    {
      $set: {
        deletionRequest: { status: DELETION_REQUEST_STATUS.PENDING, requestedAt: new Date(), reason, completedAt: null },
      },
      $push: securityEventPush(SECURITY_EVENT.DELETION_REQUESTED, ip),
    },
    { returnDocument: "after" },
  )
    .select("deletionRequest")
    .lean();
  if (!updated) throw new ApiError(409, "An account deletion request is already pending.");

  logger.info("Customer requested account deletion", { userId: String(user._id) });
  return toDeletionRequest(updated);
}

export async function cancelAccountDeletion(user, ip) {
  const updated = await User.findOneAndUpdate(
    { _id: user._id, "deletionRequest.status": DELETION_REQUEST_STATUS.PENDING },
    {
      $set: { deletionRequest: { status: DELETION_REQUEST_STATUS.NONE, requestedAt: null, reason: "", completedAt: null } },
      $push: securityEventPush(SECURITY_EVENT.DELETION_CANCELLED, ip),
    },
    { returnDocument: "after" },
  )
    .select("deletionRequest")
    .lean();
  if (!updated) throw new ApiError(409, "There is no pending deletion request to cancel.");
  return toDeletionRequest(updated);
}

const OPEN_ORDER_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.RETURN_REQUESTED,
];

/** Reasons the account cannot be anonymized yet (open fulfilment, returns or refunds). */
export async function getDeletionBlockers(customerId) {
  const [openOrders, openReturns, openRefunds] = await Promise.all([
    Order.countDocuments({ customer: customerId, orderStatus: { $in: OPEN_ORDER_STATUSES } }),
    Order.countDocuments({ customer: customerId, "returnRequest.status": { $in: [RETURN_REQUEST_STATUS.PENDING, RETURN_REQUEST_STATUS.APPROVED] } }),
    Order.countDocuments({
      customer: customerId,
      "cancellationRefund.status": { $in: ["pending", "processing", "failed", "manual_review"] },
    }),
  ]);
  const blockers = [];
  if (openOrders) blockers.push(`${openOrders} order(s) still in progress`);
  if (openReturns) blockers.push(`${openReturns} return request(s) still open`);
  if (openRefunds) blockers.push(`${openRefunds} refund(s) not yet settled`);
  return blockers;
}

/**
 * Admin action that completes a pending deletion request. Personal data on the
 * account is scrubbed and sign-in disabled; orders, payments and invoices keep
 * their immutable snapshots because they are legally required records.
 */
export async function anonymizeCustomer(customerId, actor) {
  if (!mongoose.isValidObjectId(customerId)) throw new ApiError(404, "Customer not found.");
  const customer = await User.findOne({ _id: customerId, role: ROLES.CUSTOMER }).select("deletionRequest avatar").lean();
  if (!customer) throw new ApiError(404, "Customer not found.");
  if (customer.deletionRequest?.status !== DELETION_REQUEST_STATUS.PENDING) {
    throw new ApiError(409, "Only accounts with a pending deletion request can be anonymized.");
  }

  const blockers = await getDeletionBlockers(customer._id);
  if (blockers.length) {
    throw new ApiError(409, `This account cannot be anonymized yet: ${blockers.join(", ")}.`);
  }

  const unusablePassword = await bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS);
  const completedAt = new Date();
  const updated = await User.findOneAndUpdate(
    { _id: customer._id, "deletionRequest.status": DELETION_REQUEST_STATUS.PENDING },
    {
      $set: {
        name: "Deleted customer",
        firstName: "",
        lastName: "",
        email: `deleted-${customer._id}@deleted.invalid`,
        password: unusablePassword,
        phone: "",
        companyName: "",
        gstNumber: "",
        avatar: { publicId: "", url: "" },
        addresses: [],
        defaultShippingAddressId: null,
        defaultBillingAddressId: null,
        isActive: false,
        isEmailVerified: false,
        emailVerification: EMPTY_EMAIL_VERIFICATION,
        notificationPreferences: { orderUpdates: false, shippingUpdates: false, promotional: false, promotionalConsentAt: null, backInStock: false },
        securityEvents: [],
        deletionRequest: { status: DELETION_REQUEST_STATUS.COMPLETED, requestedAt: customer.deletionRequest.requestedAt, reason: "", completedAt },
      },
      $inc: { sessionVersion: 1 },
    },
    { returnDocument: "after" },
  )
    .select("_id")
    .lean();
  if (!updated) throw new ApiError(409, "The deletion request changed while processing. Reload and try again.");

  await Promise.all([
    Cart.deleteMany({ user: customer._id }),
    Wishlist.deleteMany({ user: customer._id }),
    Notification.deleteMany({ recipientType: "customer", recipientId: customer._id }),
    StockAlert.deleteMany({ customer: customer._id }),
  ]);
  if (customer.avatar?.publicId) {
    await deleteCloudinaryImage(customer.avatar.publicId).catch((error) =>
      logger.warn("Avatar cleanup failed during anonymization", { error, customerId: String(customer._id) }),
    );
  }

  logger.info("Customer account anonymized", {
    customerId: String(customer._id),
    actor: actor?.email ?? "admin",
  });
  return { id: String(customer._id), completedAt: completedAt.toISOString() };
}
