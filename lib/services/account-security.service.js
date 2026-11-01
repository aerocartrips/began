import { createHash, randomBytes } from "node:crypto";
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
import {
  DELETION_REQUEST_STATUS,
  EMAIL_VERIFICATION_TTL_MS,
  SECURITY_EVENT,
} from "@/lib/constants/account";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/session";
import { BCRYPT_ROUNDS } from "@/lib/services/auth.service";
import {
  isCustomerEmailConfigured,
  sendEmailChangedNotice,
  sendEmailVerification,
} from "@/lib/services/email.service";
import { deleteCloudinaryImage } from "@/lib/cloudinary/delete";
import {
  changePasswordSchema,
  deletionRequestSchema,
  emailChangeSchema,
  parseOrThrow,
  verifyEmailSchema,
} from "@/lib/validators/account.validator";
import { securityEventPush, toDeletionRequest, toSecurityEvents, toSecuritySummary } from "@/lib/services/account-dto";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const EMPTY_EMAIL_VERIFICATION = { pendingEmail: "", tokenHash: "", expiresAt: null };

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

function resolveAppOrigin(requestOrigin) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  // The request origin derives from the Host header, so only trust it outside production.
  if (process.env.NODE_ENV !== "production" && requestOrigin) return requestOrigin;
  throw new ApiError(503, "Email verification is not configured. Set NEXT_PUBLIC_APP_URL.");
}

/**
 * Sends a verification link either to a new address (requires the current
 * password) or to the current, unverified address. The email on the account
 * only changes once the link is confirmed.
 * @param {{ ip?: string; origin?: string }} context
 */
export async function requestEmailVerification(user, payload, context = {}) {
  const { email, currentPassword } = parseOrThrow(emailChangeSchema, payload);
  if (!isCustomerEmailConfigured()) {
    throw new ApiError(503, "Email verification is unavailable right now. Contact support to update your email.");
  }

  const isChange = email !== user.email;
  if (!isChange && user.isEmailVerified) {
    throw new ApiError(422, "Validation failed.", [{ field: "email", message: "This email address is already verified." }]);
  }
  if (isChange) {
    if (!currentPassword) {
      throw new ApiError(422, "Validation failed.", [
        { field: "currentPassword", message: "Enter your current password to change your email." },
      ]);
    }
    await assertPassword(user._id, currentPassword);
    if (await User.exists({ email, _id: { $ne: user._id } })) {
      throw new ApiError(409, "Validation failed.", [{ field: "email", message: "This email address is already in use." }]);
    }
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  const verifyUrl = `${resolveAppOrigin(context.origin)}/account/verify-email?token=${token}`;

  await User.updateOne(
    { _id: user._id },
    {
      $set: { emailVerification: { pendingEmail: email, tokenHash: hashToken(token), expiresAt } },
      ...(isChange ? { $push: securityEventPush(SECURITY_EVENT.EMAIL_CHANGE_REQUESTED, context.ip) } : {}),
    },
  );

  const delivery = await sendEmailVerification({ to: email, name: user.name, verifyUrl, isChange });
  if (!delivery.sent) {
    throw new ApiError(502, "We could not send the verification email. Please try again shortly.");
  }
  return { pendingEmail: isChange ? email : "", expiresAt: expiresAt.toISOString() };
}

export async function cancelEmailChange(user) {
  await User.updateOne({ _id: user._id }, { $set: { emailVerification: EMPTY_EMAIL_VERIFICATION } });
}

/**
 * Consumes a verification token. Possession of the emailed link proves control
 * of the address; the token is single-use and expires after an hour.
 */
export async function confirmEmailVerification(payload, ip) {
  const { token } = parseOrThrow(verifyEmailSchema, payload);
  const tokenHash = hashToken(token);
  const invalid = () => new ApiError(400, "This verification link is invalid or has expired.");

  const record = await User.findOne({
    "emailVerification.tokenHash": tokenHash,
    "emailVerification.expiresAt": { $gt: new Date() },
    isActive: true,
  })
    .select("name email emailVerification.pendingEmail")
    .lean();
  if (!record?.emailVerification?.pendingEmail) throw invalid();

  const previousEmail = record.email;
  const email = record.emailVerification.pendingEmail;
  let updated;
  try {
    updated = await User.findOneAndUpdate(
      { _id: record._id, "emailVerification.tokenHash": tokenHash },
      {
        $set: { email, isEmailVerified: true, emailVerification: EMPTY_EMAIL_VERIFICATION },
        $push: securityEventPush(SECURITY_EVENT.EMAIL_VERIFIED, ip),
      },
      { returnDocument: "after" },
    )
      .select("email")
      .lean();
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "This email address is already in use by another account.");
    }
    throw error;
  }
  if (!updated) throw invalid();

  if (previousEmail !== email) {
    await sendEmailChangedNotice({ to: previousEmail, name: record.name, newEmail: email }).catch((error) =>
      logger.warn("Email change notice failed", { error, userId: String(record._id) }),
    );
  }
  return { email: updated.email, changed: previousEmail !== email };
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
