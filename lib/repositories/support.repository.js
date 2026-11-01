import mongoose from "mongoose";
import { SupportConversation } from "@/lib/db/models/SupportConversation";
import { SUPPORT_SENDER_ROLE, SupportMessage } from "@/lib/db/models/SupportMessage";
import { SUPPORT_LIMITS } from "@/lib/constants/support";
import { ApiError } from "@/lib/utils/api-error";

const MESSAGE_FIELDS = "conversation senderRole body createdAt readByAdmin readByCustomer clientMessageId";

/**
 * Opaque, stable cursor: base36 timestamp + ObjectId. Ordering is
 * (createdAt, _id) so messages created in the same millisecond still page
 * deterministically.
 * @param {{ _id: unknown; createdAt: Date }} message
 */
export function encodeMessageCursor(message) {
  return `${new Date(message.createdAt).getTime().toString(36)}.${String(message._id)}`;
}

/**
 * @param {string} cursor
 */
export function decodeMessageCursor(cursor) {
  const match = /^([0-9a-z]{1,12})\.([0-9a-f]{24})$/.exec(cursor);
  if (!match) throw new ApiError(400, "Invalid cursor.");
  const time = parseInt(match[1], 36);
  if (!Number.isFinite(time)) throw new ApiError(400, "Invalid cursor.");
  return { createdAt: new Date(time), id: new mongoose.Types.ObjectId(match[2]) };
}

export function messagePreview(body) {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > SUPPORT_LIMITS.previewLength
    ? `${flat.slice(0, SUPPORT_LIMITS.previewLength - 1)}…`
    : flat;
}

/**
 * @param {string | null | undefined} raw
 */
export function parseMessageLimit(raw) {
  const value = Number(raw ?? SUPPORT_LIMITS.messagesPageDefault);
  if (!Number.isFinite(value) || value < 1) return SUPPORT_LIMITS.messagesPageDefault;
  return Math.min(Math.floor(value), SUPPORT_LIMITS.messagesPageMax);
}

/**
 * Latest messages first: with no cursor (or `before`) returns the newest page
 * older than the cursor; with `after` returns messages newer than the cursor
 * (used for polling). Items are always returned oldest → newest.
 * @param {import("mongoose").Types.ObjectId | string} conversationId
 * @param {{ before?: string | null; after?: string | null; limit?: number }} options
 */
export async function findMessagesPage(conversationId, { before, after, limit = SUPPORT_LIMITS.messagesPageDefault } = {}) {
  if (before && after) throw new ApiError(400, "Use either before or after, not both.");
  const filter = { conversation: conversationId };
  const newerThan = Boolean(after);
  const cursor = before || after;

  if (cursor) {
    const { createdAt, id } = decodeMessageCursor(cursor);
    const op = newerThan ? "$gt" : "$lt";
    filter.$or = [{ createdAt: { [op]: createdAt } }, { createdAt, _id: { [op]: id } }];
  }

  const direction = newerThan ? 1 : -1;
  const rows = await SupportMessage.find(filter)
    .select(MESSAGE_FIELDS)
    .sort({ createdAt: direction, _id: direction })
    .limit(limit + 1)
    .lean();

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  if (!newerThan) page.reverse();
  return { items: page, hasMore };
}

/**
 * Inserts a message once per `clientMessageId`; a retried request returns the
 * originally stored message with `created: false`.
 * @param {{
 *   conversationId: import("mongoose").Types.ObjectId;
 *   senderRole: string;
 *   sender?: import("mongoose").Types.ObjectId | null;
 *   body: string;
 *   clientMessageId?: string;
 * }} input
 */
export async function insertSupportMessage({ conversationId, senderRole, sender = null, body, clientMessageId }) {
  const findExisting = () =>
    clientMessageId
      ? SupportMessage.findOne({ conversation: conversationId, clientMessageId }).select(MESSAGE_FIELDS).lean()
      : null;

  const existing = await findExisting();
  if (existing) return { message: existing, created: false };

  const fromCustomer = senderRole === SUPPORT_SENDER_ROLE.CUSTOMER;
  try {
    const doc = await SupportMessage.create({
      conversation: conversationId,
      sender,
      senderRole,
      body,
      readByAdmin: !fromCustomer,
      readByCustomer: fromCustomer,
      ...(clientMessageId ? { clientMessageId } : {}),
    });
    return { message: doc.toObject(), created: true };
  } catch (error) {
    // Concurrent retry won the race on the unique (conversation, clientMessageId) index.
    if (clientMessageId && /** @type {{ code?: number }} */ (error)?.code === 11000) {
      const winner = await findExisting();
      if (winner) return { message: winner, created: false };
    }
    throw error;
  }
}

/**
 * Updates the conversation's denormalised "latest activity" fields and the
 * counterpart's unread counter in a single atomic write.
 * @param {import("mongoose").Types.ObjectId} conversationId
 * @param {{ body: string; senderRole: string; createdAt: Date }} message
 * @param {{ set?: Record<string, unknown>; projection?: string }} [options]
 */
export async function recordConversationActivity(conversationId, message, { set = {}, projection } = {}) {
  const unreadField =
    message.senderRole === SUPPORT_SENDER_ROLE.CUSTOMER ? "unreadByAdmin" : "unreadByCustomer";
  return SupportConversation.findOneAndUpdate(
    { _id: conversationId },
    {
      $set: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: messagePreview(message.body),
        lastMessageRole: message.senderRole,
        ...set,
      },
      $inc: { [unreadField]: 1 },
    },
    { returnDocument: "after", projection },
  ).lean();
}

/**
 * Marks the counterpart's messages as read for `reader` and recomputes the
 * unread counter from the messages themselves, so a message that arrives
 * mid-update is never lost from the count.
 * @param {import("mongoose").Types.ObjectId} conversationId
 * @param {"customer" | "admin"} reader
 */
export async function markConversationRead(conversationId, reader) {
  const readField = reader === "customer" ? "readByCustomer" : "readByAdmin";
  const counterField = reader === "customer" ? "unreadByCustomer" : "unreadByAdmin";
  const unreadFilter = {
    conversation: conversationId,
    senderRole: reader === "customer" ? { $ne: SUPPORT_SENDER_ROLE.CUSTOMER } : SUPPORT_SENDER_ROLE.CUSTOMER,
    [readField]: false,
  };

  await SupportMessage.updateMany(unreadFilter, { $set: { [readField]: true } });
  const remaining = await SupportMessage.countDocuments(unreadFilter);
  await SupportConversation.updateOne({ _id: conversationId }, { $set: { [counterField]: remaining } });
  return { unread: remaining };
}

/**
 * Fills preview data for conversations created before `lastMessagePreview`
 * was stored, using a single aggregation for the whole page.
 * @param {{ _id: unknown; lastMessagePreview?: string; lastMessageRole?: string }[]} rows
 */
export async function backfillPreviews(rows) {
  const missing = rows.filter((row) => !row.lastMessagePreview).map((row) => row._id);
  if (!missing.length) return rows;
  const latest = await SupportMessage.aggregate([
    { $match: { conversation: { $in: missing } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$conversation", body: { $first: "$body" }, senderRole: { $first: "$senderRole" } } },
  ]);
  const map = new Map(latest.map((row) => [String(row._id), row]));
  return rows.map((row) => {
    const found = map.get(String(row._id));
    if (!found || row.lastMessagePreview) return row;
    return { ...row, lastMessagePreview: messagePreview(found.body), lastMessageRole: found.senderRole };
  });
}
