import { after } from "next/server";
import mongoose from "mongoose";
import {
  EMAIL_NOTIFICATION_PREFERENCE,
  NOTIFICATION_LIMITS,
  NOTIFICATION_RECIPIENT,
  NOTIFICATION_SEVERITY,
  OPTIONAL_NOTIFICATION_PREFERENCE,
} from "@/lib/constants/notifications";
import { Notification } from "@/lib/db/models/Notification";
import { User } from "@/lib/db/models/User";
import { resolveAdminRecipientIds } from "@/lib/notifications/admin-recipients";
import {
  countUnreadNotifications,
  findNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  upsertNotifications,
} from "@/lib/repositories/notification.repository";
import { ApiError } from "@/lib/utils/api-error";
import { logger } from "@/lib/utils/logger";
import { parseOrThrow } from "@/lib/validators/account.validator";
import { listNotificationsQuerySchema } from "@/lib/validators/notification.validator";

/**
 * @typedef {{
 *   type: string;
 *   title: string;
 *   message?: string;
 *   severity?: string;
 *   entityType?: string;
 *   entityId?: unknown;
 *   url?: string;
 *   metadata?: Record<string, unknown>;
 *   dedupeKey?: string;
 *   groupKey?: string;
 * }} NotificationContent
 */

/** @type {Set<Promise<void>>} */
const pending = new Set();
const RETRY_DELAY_MS = 250;

/**
 * Runs notification work off the critical path. Inside a request the work runs
 * after the response is sent (`after`); elsewhere (jobs, scripts, tests) it runs
 * concurrently. Failures are retried once and logged, never thrown, so a
 * notification problem can never fail or roll back an order or payment.
 * @param {string} event
 * @param {() => Promise<unknown>} task
 */
export function dispatchNotification(event, task) {
  const run = async () => {
    try {
      await task();
    } catch (firstError) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      try {
        await task();
      } catch (error) {
        logger.error("Notification delivery failed", { event, error, firstError: String(firstError?.message ?? firstError) });
      }
    }
  };

  try {
    after(run);
    return;
  } catch {
    // Outside a request scope.
  }
  const promise = run().finally(() => pending.delete(promise));
  pending.add(promise);
}

/** Waits for notification work started outside a request scope (used by jobs and tests). */
export async function flushNotifications() {
  while (pending.size) await Promise.all([...pending]);
}

/**
 * @param {NotificationContent} content
 */
function normalizeContent(content) {
  if (!content.dedupeKey && !content.groupKey) {
    throw new Error(`Notification "${content.type}" needs a dedupeKey or groupKey.`);
  }
  return {
    type: content.type,
    severity: content.severity ?? NOTIFICATION_SEVERITY.INFO,
    title: content.title.slice(0, NOTIFICATION_LIMITS.titleMax),
    message: (content.message ?? "").slice(0, NOTIFICATION_LIMITS.messageMax),
    entityType: content.entityType ?? null,
    entityId: content.entityId ? String(content.entityId) : null,
    url: content.url?.startsWith("/") ? content.url : "",
    ...(content.metadata ? { metadata: content.metadata } : {}),
    ...(content.dedupeKey ? { dedupeKey: content.dedupeKey } : { groupKey: content.groupKey }),
  };
}

/**
 * Creates a customer notification, respecting optional-notification preferences,
 * and emails it when the type is email-eligible and the customer opted in.
 * @param {unknown} customerId
 * @param {NotificationContent} content
 */
export async function notifyCustomer(customerId, content) {
  if (!customerId || !mongoose.isValidObjectId(String(customerId))) return [];
  const draft = normalizeContent(content);
  const optionalPreference = OPTIONAL_NOTIFICATION_PREFERENCE[draft.type];
  const emailPreference = isCustomerEmailChannelEnabled() ? EMAIL_NOTIFICATION_PREFERENCE[draft.type] : undefined;

  let customer = null;
  if (optionalPreference || emailPreference) {
    customer = await User.findById(customerId).select("email name isActive notificationPreferences").lean();
    if (!customer?.isActive) return [];
    if (optionalPreference && customer.notificationPreferences?.[optionalPreference] === false) return [];
  }

  const inserted = await upsertNotifications([
    { ...draft, recipientType: NOTIFICATION_RECIPIENT.CUSTOMER, recipientId: new mongoose.Types.ObjectId(String(customerId)) },
  ]);

  if (inserted.length && emailPreference && customer) {
    await deliverEmail(inserted[0], customer, draft, emailPreference);
  }
  return inserted;
}

/**
 * Notifies many customers at once (e.g. back-in-stock subscribers) with one
 * preference query and one bulk write.
 * @param {unknown[]} customerIds
 * @param {(customerId: string) => NotificationContent} build
 */
export async function notifyCustomers(customerIds, build) {
  if (!customerIds.length) return [];
  const sample = build(String(customerIds[0]));
  const optionalPreference = OPTIONAL_NOTIFICATION_PREFERENCE[sample.type];
  const customers = await User.find({ _id: { $in: customerIds }, isActive: true })
    .select(optionalPreference ? `_id notificationPreferences.${optionalPreference}` : "_id")
    .lean();
  const eligible = customers.filter(
    (customer) => !optionalPreference || customer.notificationPreferences?.[optionalPreference] !== false,
  );
  return upsertNotifications(
    eligible.map((customer) => ({
      ...normalizeContent(build(String(customer._id))),
      recipientType: NOTIFICATION_RECIPIENT.CUSTOMER,
      recipientId: customer._id,
    })),
  );
}

/**
 * Fans notifications out to every admin allowed to see `audience`, in one bulk write.
 * @param {string} audience
 * @param {NotificationContent | NotificationContent[]} contents
 */
export async function notifyAdmins(audience, contents) {
  const drafts = (Array.isArray(contents) ? contents : [contents]).map(normalizeContent);
  if (!drafts.length) return [];
  const recipientIds = await resolveAdminRecipientIds(audience);
  return upsertNotifications(
    recipientIds.flatMap((recipientId) =>
      drafts.map((draft) => ({ ...draft, audience, recipientType: NOTIFICATION_RECIPIENT.ADMIN, recipientId })),
    ),
  );
}

function isCustomerEmailChannelEnabled() {
  return process.env.CUSTOMER_NOTIFICATION_EMAILS === "true" && Boolean(process.env.RESEND_API_KEY?.trim());
}

function absoluteUrl(path) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return base && path ? new URL(path, base).toString() : "";
}

/**
 * Email is a separate channel with its own consent; its outcome is recorded on
 * the notification so an in-app entry never implies an email was delivered.
 */
async function deliverEmail(notificationId, customer, draft, preference) {
  let status = "skipped";
  if (customer.email && customer.notificationPreferences?.[preference] !== false) {
    const { sendTransactionalEmail } = await import("@/lib/services/email.service");
    const link = absoluteUrl(draft.url);
    const result = await sendTransactionalEmail({
      to: customer.email,
      subject: draft.title,
      text: [`Hello ${customer.name ?? ""},`, "", draft.message, link ? `\nView details: ${link}` : ""].join("\n"),
    }).catch((error) => {
      logger.warn("Notification email failed", { error, notificationId: String(notificationId) });
      return { sent: false };
    });
    status = result.sent ? "sent" : "failed";
  }
  await Notification.updateOne({ _id: notificationId }, { $set: { email: { status, at: new Date() } } });
}

/** @param {Record<string, any>} row */
export function toNotificationDto(row) {
  return {
    id: String(row._id),
    type: row.type,
    severity: row.severity ?? NOTIFICATION_SEVERITY.INFO,
    title: row.title,
    message: row.message ?? "",
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    url: row.url || null,
    isRead: Boolean(row.isRead),
    readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
    count: row.groupCount ?? 1,
    metadata: row.metadata ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/**
 * @param {import("@/lib/repositories/notification.repository").Recipient} recipient
 * @param {URLSearchParams} searchParams
 * @param {string[] | null} [audiences]
 */
export async function listNotifications(recipient, searchParams, audiences = null) {
  const query = parseOrThrow(listNotificationsQuerySchema, Object.fromEntries(searchParams));
  const [page, unreadCount] = await Promise.all([
    findNotificationsPage(recipient, { ...query, audiences }),
    countUnreadNotifications(recipient, audiences),
  ]);
  return {
    items: page.items.map(toNotificationDto),
    meta: { hasMore: page.hasMore, nextCursor: page.nextCursor, unreadCount },
  };
}

/**
 * @param {import("@/lib/repositories/notification.repository").Recipient} recipient
 * @param {string[] | null} [audiences]
 */
export async function getUnreadCount(recipient, audiences = null) {
  return { unreadCount: await countUnreadNotifications(recipient, audiences) };
}

/**
 * @param {import("@/lib/repositories/notification.repository").Recipient} recipient
 * @param {string} notificationId
 * @param {string[] | null} [audiences]
 */
export async function readNotification(recipient, notificationId, audiences = null) {
  if (!mongoose.isValidObjectId(notificationId)) throw new ApiError(404, "Notification not found.");
  const found = await markNotificationRead(recipient, notificationId, audiences);
  if (!found) throw new ApiError(404, "Notification not found.");
  return { id: notificationId, ...(await getUnreadCount(recipient, audiences)) };
}

/**
 * @param {import("@/lib/repositories/notification.repository").Recipient} recipient
 * @param {string[] | null} [audiences]
 */
export async function readAllNotifications(recipient, audiences = null) {
  const updated = await markAllNotificationsRead(recipient, audiences);
  return { updated, unreadCount: 0 };
}
