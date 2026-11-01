import mongoose from "mongoose";
import { Notification } from "@/lib/db/models/Notification";
import { NOTIFICATION_LIMITS } from "@/lib/constants/notifications";

/** Fields returned to clients; recipient, idempotency and delivery internals stay server-side. */
const LIST_PROJECTION = "type severity title message entityType entityId url isRead readAt groupCount metadata createdAt";

/**
 * @typedef {{ recipientType: string; recipientId: import("mongoose").Types.ObjectId }} Recipient
 * @typedef {Recipient & {
 *   audience?: string | null;
 *   type: string;
 *   severity: string;
 *   title: string;
 *   message: string;
 *   entityType?: string | null;
 *   entityId?: string | null;
 *   url: string;
 *   metadata?: Record<string, unknown>;
 *   dedupeKey?: string;
 *   groupKey?: string;
 * }} NotificationDraft
 */

/** @param {{ createdAt: Date; _id: unknown }} row */
export function encodeNotificationCursor(row) {
  return Buffer.from(`${new Date(row.createdAt).getTime()}:${row._id}`).toString("base64url");
}

/** @param {string | null | undefined} cursor */
export function decodeNotificationCursor(cursor) {
  if (!cursor) return null;
  const [ms, id] = Buffer.from(cursor, "base64url").toString("utf8").split(":");
  const time = Number(ms);
  if (!Number.isFinite(time) || !mongoose.isValidObjectId(id)) return null;
  return { createdAt: new Date(time), id: new mongoose.Types.ObjectId(id) };
}

/**
 * Writes notifications idempotently in one round trip.
 * - `dedupeKey` drafts are inserted only if that (recipient, key) pair does not exist yet.
 * - `groupKey` drafts merge into the recipient's unread notification for the same group.
 * MongoDB retries upserts that race on a unique index, so concurrent retries cannot duplicate.
 * @param {NotificationDraft[]} drafts
 * @returns {Promise<import("mongoose").Types.ObjectId[]>} ids of newly inserted notifications
 */
export async function upsertNotifications(drafts, now = new Date()) {
  if (!drafts.length) return [];
  const expiresAt = new Date(now.getTime() + NOTIFICATION_LIMITS.retentionDays * 24 * 60 * 60 * 1000);

  const operations = drafts.map((draft) => {
    const { dedupeKey, groupKey, ...content } = draft;
    const base = {
      audience: null,
      entityType: null,
      entityId: null,
      ...content,
      isRead: false,
      readAt: null,
    };
    const options = { upsert: true, timestamps: false, setDefaultsOnInsert: false };

    if (groupKey) {
      const { recipientType, recipientId, ...mutable } = base;
      return {
        updateOne: {
          filter: { recipientType, recipientId, groupKey, isRead: false },
          update: {
            $set: { ...mutable, createdAt: now, expiresAt },
            $inc: { groupCount: 1 },
          },
          ...options,
        },
      };
    }

    return {
      updateOne: {
        filter: { recipientType: base.recipientType, recipientId: base.recipientId, dedupeKey },
        update: { $setOnInsert: { ...base, dedupeKey, createdAt: now, expiresAt } },
        ...options,
      },
    };
  });

  const result = await Notification.bulkWrite(operations, { ordered: false });
  return Object.values(result.upsertedIds ?? {});
}

/**
 * @param {Recipient} recipient
 * @param {string[] | null} audiences when set, only these admin audiences are visible
 */
function ownerFilter(recipient, audiences) {
  return {
    recipientType: recipient.recipientType,
    recipientId: recipient.recipientId,
    ...(audiences ? { audience: { $in: audiences } } : {}),
  };
}

/**
 * Cursor-paginated inbox, newest first. Fetches one extra row to detect another page.
 * @param {Recipient} recipient
 * @param {{ cursor?: string | null; limit: number; unreadOnly?: boolean; audiences?: string[] | null }} options
 */
export async function findNotificationsPage(recipient, { cursor, limit, unreadOnly = false, audiences = null }) {
  const filter = ownerFilter(recipient, audiences);
  if (unreadOnly) filter.isRead = false;
  const position = decodeNotificationCursor(cursor);
  if (position) {
    filter.$or = [
      { createdAt: { $lt: position.createdAt } },
      { createdAt: position.createdAt, _id: { $lt: position.id } },
    ];
  }

  const rows = await Notification.find(filter)
    .select(LIST_PROJECTION)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, hasMore, nextCursor: hasMore ? encodeNotificationCursor(items[items.length - 1]) : null };
}

/**
 * Counting stops at the display cap, so a huge backlog never costs a full scan.
 * @param {Recipient} recipient
 * @param {string[] | null} [audiences]
 */
export function countUnreadNotifications(recipient, audiences = null) {
  return Notification.countDocuments(
    { ...ownerFilter(recipient, audiences), isRead: false },
    { limit: NOTIFICATION_LIMITS.unreadCountCap },
  );
}

/**
 * Marks one notification read. Returns false when it does not exist or belongs
 * to someone else, which callers report as 404 so ids cannot be probed.
 * @param {Recipient} recipient
 * @param {string} notificationId
 * @param {string[] | null} [audiences]
 */
export async function markNotificationRead(recipient, notificationId, audiences = null) {
  const filter = { _id: notificationId, ...ownerFilter(recipient, audiences) };
  const result = await Notification.updateOne({ ...filter, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  if (result.modifiedCount > 0) return true;
  return Boolean(await Notification.exists(filter));
}

/**
 * @param {Recipient} recipient
 * @param {string[] | null} [audiences]
 */
export async function markAllNotificationsRead(recipient, audiences = null) {
  const result = await Notification.updateMany(
    { ...ownerFilter(recipient, audiences), isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
  return result.modifiedCount;
}
