import { User } from "@/lib/db/models/User";
import { Order } from "@/lib/db/models/Order";
import { Review } from "@/lib/db/models/Review";
import { SupportConversation } from "@/lib/db/models/SupportConversation";
import { SupportMessage } from "@/lib/db/models/SupportMessage";
import "@/lib/db/models/Product";
import { ApiError } from "@/lib/utils/api-error";
import { logger } from "@/lib/utils/logger";
import { SECURITY_EVENT } from "@/lib/constants/account";
import { CLOUDINARY_FOLDERS } from "@/lib/constants/cloudinary-folders";
import { isCloudinaryConfigured } from "@/lib/cloudinary/config";
import { uploadImageFile } from "@/lib/cloudinary/upload";
import { deleteCloudinaryImage } from "@/lib/cloudinary/delete";
import { validateUploadFile } from "@/lib/validators/upload.validator";
import { parseOrThrow, preferencesSchema, profileUpdateSchema } from "@/lib/validators/account.validator";
import { isCustomerEmailConfigured } from "@/lib/services/email.service";
import { orderRepository } from "@/lib/repositories/order.repository";
import { resolveDefaultAddressIds, toAddressBook } from "@/lib/services/address.service";
import {
  securityEventPush,
  splitName,
  toAccountProfile,
  toDeletionRequest,
  toPreferences,
  toSecuritySummary,
} from "@/lib/services/account-dto";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function getAccountCapabilities() {
  return {
    emailVerification: isCustomerEmailConfigured(),
    avatarUpload: isCloudinaryConfigured(),
  };
}

export function getProfile(user) {
  return { profile: toAccountProfile(user), capabilities: getAccountCapabilities() };
}

/**
 * Only whitelisted fields are written; `name` is derived so every module that
 * shows the customer's name stays in sync.
 */
export async function updateProfile(user, payload, ip) {
  const data = parseOrThrow(profileUpdateSchema, payload);
  const current = splitName(user);
  const firstName = data.firstName ?? current.firstName;
  const lastName = data.lastName ?? current.lastName;
  const name = [firstName, lastName].filter(Boolean).join(" ");
  if (name.length < 2) {
    throw new ApiError(422, "Validation failed.", [{ field: "firstName", message: "Enter your full name." }]);
  }

  /** @type {Record<string, string>} */
  const $set = { firstName, lastName, name };
  for (const key of /** @type {const} */ (["phone", "companyName", "gstNumber"])) {
    if (data[key] !== undefined) $set[key] = data[key];
  }

  const updated = await User.findOneAndUpdate(
    { _id: user._id },
    { $set, $push: securityEventPush(SECURITY_EVENT.PROFILE_UPDATED, ip) },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!updated) throw new ApiError(404, "Account not found.");
  return toAccountProfile(updated);
}

/** @param {File} file */
export async function updateAvatar(user, file) {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, "Profile photo uploads are not available right now.");
  }
  const validation = validateUploadFile(file);
  if (!validation.ok) {
    throw new ApiError(422, "Validation failed.", [{ field: "file", message: validation.message }]);
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new ApiError(422, "Validation failed.", [{ field: "file", message: "Profile photos must be 5 MB or smaller." }]);
  }

  const image = await uploadImageFile(file, { folder: CLOUDINARY_FOLDERS.avatars, tags: ["avatar"] });
  const previous = await User.findOneAndUpdate(
    { _id: user._id },
    { $set: { avatar: { publicId: image.publicId, url: image.secureUrl || image.url } } },
    { returnDocument: "before" },
  )
    .select("avatar")
    .lean();
  await removeStoredAvatar(previous?.avatar?.publicId);
  return { avatarUrl: image.secureUrl || image.url };
}

export async function removeAvatar(user) {
  const previous = await User.findOneAndUpdate(
    { _id: user._id },
    { $set: { avatar: { publicId: "", url: "" } } },
    { returnDocument: "before" },
  )
    .select("avatar")
    .lean();
  await removeStoredAvatar(previous?.avatar?.publicId);
  return { avatarUrl: "" };
}

async function removeStoredAvatar(publicId) {
  if (!publicId) return;
  await deleteCloudinaryImage(publicId).catch((error) =>
    logger.warn("Previous avatar could not be removed from Cloudinary", { error, publicId }),
  );
}

export function getPreferences(user) {
  return toPreferences(user);
}

/**
 * Each category is stored independently, so opting out of promotions never
 * affects order or shipping notices. Promotional consent changes are timestamped.
 */
export async function updatePreferences(user, payload) {
  const data = parseOrThrow(preferencesSchema, payload);
  /** @type {Record<string, unknown>} */
  const $set = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) $set[`notificationPreferences.${key}`] = value;
  }
  if (data.promotional !== undefined && data.promotional !== toPreferences(user).promotional) {
    $set["notificationPreferences.promotionalConsentAt"] = data.promotional ? new Date() : null;
  }

  const updated = await User.findOneAndUpdate({ _id: user._id }, { $set }, { returnDocument: "after" })
    .select("notificationPreferences")
    .lean();
  if (!updated) throw new ApiError(404, "Account not found.");
  return toPreferences(updated);
}

const RECENT_ORDER_FIELDS =
  "orderNumber createdAt totalAmount orderStatus paymentStatus items.productName items.quantity items.imageUrl";

function toRecentOrder(order) {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    createdAt: new Date(order.createdAt).toISOString(),
    totalAmount: order.totalAmount,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    firstItemName: order.items[0]?.productName ?? "",
    imageUrl: order.items[0]?.imageUrl ?? "",
  };
}

/**
 * @param {ReturnType<typeof toAccountProfile>} profile
 * @param {boolean} hasDefaultAddress
 */
function buildCompletion(profile, hasDefaultAddress) {
  const items = [
    { key: "name", label: "Add your full name", done: Boolean(profile.firstName && profile.lastName), href: "/account/profile" },
    { key: "phone", label: "Add a phone number", done: Boolean(profile.phone), href: "/account/profile" },
    { key: "email", label: "Verify your email address", done: profile.isEmailVerified, href: "/account/profile" },
    { key: "company", label: "Add your business name", done: Boolean(profile.companyName), href: "/account/profile" },
    { key: "address", label: "Save a default shipping address", done: hasDefaultAddress, href: "/account/addresses" },
  ];
  const completed = items.filter((item) => item.done).length;
  return { percent: Math.round((completed / items.length) * 100), items };
}

export async function getAccountOverview(user) {
  const [summary, recentOrders] = await Promise.all([
    orderRepository.aggregateSummary(user._id),
    Order.find({ customer: user._id }).sort({ createdAt: -1 }).limit(4).select(RECENT_ORDER_FIELDS).lean(),
  ]);

  const profile = toAccountProfile(user);
  const book = toAddressBook(user);
  const defaultShipping = book.items.find((item) => item.isDefaultShipping) ?? null;
  const deletionRequest = toDeletionRequest(user);

  const actions = [];
  if (summary.pendingPayment > 0) {
    actions.push({
      key: "payment",
      tone: "warning",
      title: `${summary.pendingPayment} order${summary.pendingPayment === 1 ? "" : "s"} awaiting payment`,
      description: "Complete payment before the reservation expires to keep your stock.",
      href: "/account/orders",
      cta: "Review orders",
    });
  }
  if (!profile.isEmailVerified) {
    actions.push({
      key: "email",
      tone: "info",
      title: "Verify your email address",
      description: "A verified email keeps order and account notices reaching you.",
      href: "/account/profile",
      cta: "Verify email",
    });
  }
  if (!defaultShipping) {
    actions.push({
      key: "address",
      tone: "info",
      title: "Save a shipping address",
      description: "Checkout is faster when your delivery details are saved.",
      href: "/account/addresses",
      cta: "Add address",
    });
  }
  if (deletionRequest.status === "pending") {
    actions.push({
      key: "deletion",
      tone: "danger",
      title: "Account deletion requested",
      description: "Our team will process your request. You can cancel it from Account Settings.",
      href: "/account/settings",
      cta: "Manage request",
    });
  }

  return {
    profile,
    completion: buildCompletion(profile, Boolean(defaultShipping)),
    defaultShipping,
    addressCount: book.items.length,
    orderSummary: {
      total: summary.total,
      pendingPayment: summary.pendingPayment,
      inProgress: summary.processing + summary.shipped,
      delivered: summary.delivered,
    },
    recentOrders: recentOrders.map(toRecentOrder),
    actions,
    security: toSecuritySummary(user),
  };
}

const EXPORT_ORDER_FIELDS = [
  "orderNumber",
  "createdAt",
  "items.productName",
  "items.sku",
  "items.quantity",
  "items.unitPrice",
  "items.lineTotal",
  "items.selectedAttributes",
  "shippingAddress",
  "billingAddress",
  "subtotal",
  "discount",
  "shippingCharges",
  "tax",
  "totalAmount",
  "currency",
  "paymentMethod",
  "paymentStatus",
  "orderStatus",
  "notes",
  "invoice.number",
  "invoice.issuedAt",
  "cancellation.reason",
  "cancellation.cancelledAt",
  "returnRequest.status",
  "returnRequest.reason",
  "returnRequest.requestedAt",
].join(" ");

const EXPORT_MESSAGE_LIMIT = 5000;

/**
 * Portable copy of the customer's personal data. Internal staff notes, payment
 * gateway payloads and credentials are excluded.
 */
export async function buildAccountExport(user) {
  const [account, orders, reviews, conversations] = await Promise.all([
    User.findById(user._id).select("+securityEvents").lean(),
    Order.find({ customer: user._id }).sort({ createdAt: -1 }).select(EXPORT_ORDER_FIELDS).lean(),
    Review.find({ user: user._id })
      .sort({ createdAt: -1 })
      .select("product order rating title comment moderationStatus createdAt updatedAt")
      .populate("product", "name")
      .lean(),
    SupportConversation.find({ customer: user._id })
      .sort({ createdAt: -1 })
      .select("subject category status createdAt resolvedAt")
      .lean(),
  ]);
  if (!account) throw new ApiError(404, "Account not found.");

  const messages = conversations.length
    ? await SupportMessage.find({ conversation: { $in: conversations.map((conversation) => conversation._id) } })
        .sort({ createdAt: 1 })
        .limit(EXPORT_MESSAGE_LIMIT)
        .select("conversation senderRole body createdAt")
        .lean()
    : [];
  /** @type {Map<string, typeof messages>} */
  const messagesByConversation = new Map();
  for (const message of messages) {
    const key = String(message.conversation);
    const bucket = messagesByConversation.get(key);
    if (bucket) bucket.push(message);
    else messagesByConversation.set(key, [message]);
  }
  const defaults = resolveDefaultAddressIds(account);

  return {
    exportedAt: new Date().toISOString(),
    profile: toAccountProfile(account),
    preferences: toPreferences(account),
    security: {
      ...toSecuritySummary(account),
      recentActivity: (account.securityEvents ?? []).map((event) => ({ type: event.type, at: event.at, ip: event.ip })),
    },
    deletionRequest: toDeletionRequest(account),
    addresses: toAddressBook(account).items,
    defaultAddresses: defaults,
    orders: orders.map(({ _id, ...order }) => ({ id: String(_id), ...order })),
    reviews: reviews.map((review) => ({
      id: String(review._id),
      product: review.product?.name ?? null,
      orderId: String(review.order),
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      moderationStatus: review.moderationStatus,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    })),
    supportConversations: conversations.map((conversation) => ({
      id: String(conversation._id),
      subject: conversation.subject,
      category: conversation.category,
      status: conversation.status,
      createdAt: conversation.createdAt,
      resolvedAt: conversation.resolvedAt,
      messages: (messagesByConversation.get(String(conversation._id)) ?? []).map((message) => ({
        from: message.senderRole,
        body: message.body,
        at: message.createdAt,
      })),
    })),
  };
}
