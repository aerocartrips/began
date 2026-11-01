import mongoose from "mongoose";
import { Order } from "@/lib/db/models/Order";
import { SUPPORT_CONVERSATION_STATUS, SupportConversation } from "@/lib/db/models/SupportConversation";
import { SUPPORT_SENDER_ROLE, SupportMessage } from "@/lib/db/models/SupportMessage";
import {
  CUSTOMER_SUPPORT_STATUS,
  SUPPORT_CATEGORY,
  SUPPORT_LIMITS,
  SUPPORT_SOURCE,
} from "@/lib/constants/support";
import {
  backfillPreviews,
  encodeMessageCursor,
  findMessagesPage,
  insertSupportMessage,
  markConversationRead,
  messagePreview,
  parseMessageLimit,
  recordConversationActivity,
} from "@/lib/repositories/support.repository";
import { ApiError } from "@/lib/utils/api-error";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import {
  createSupportConversationSchema,
  customerConversationUpdateSchema,
  sendSupportMessageSchema,
} from "@/lib/validators/support.validator";

/** Only fields safe to show the customer; internal notes, priority and assignee never leave the server. */
const CUSTOMER_CONVERSATION_FIELDS =
  "subject category status order lastMessageAt lastMessagePreview lastMessageRole unreadByCustomer resolvedAt createdAt";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @template T
 * @param {import("zod").ZodType<T>} schema
 * @param {unknown} payload
 * @returns {T}
 */
function parseOrThrow(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Please check the highlighted fields.", formatZodErrors(parsed.error));
  }
  return parsed.data;
}

/**
 * @param {string} status
 */
export function toCustomerStatus(status) {
  switch (status) {
    case SUPPORT_CONVERSATION_STATUS.IN_PROGRESS:
    case SUPPORT_CONVERSATION_STATUS.WAITING_CUSTOMER:
      return CUSTOMER_SUPPORT_STATUS.PENDING;
    case SUPPORT_CONVERSATION_STATUS.RESOLVED:
      return CUSTOMER_SUPPORT_STATUS.RESOLVED;
    case SUPPORT_CONVERSATION_STATUS.CLOSED:
      return CUSTOMER_SUPPORT_STATUS.CLOSED;
    default:
      return CUSTOMER_SUPPORT_STATUS.OPEN;
  }
}

/**
 * Closed conversations are read-only. Resolved ones can be reopened by a reply
 * for a limited window, after which the customer starts a new conversation.
 * @param {{ status: string; resolvedAt?: Date | null }} conversation
 * @param {number} [now]
 */
export function canCustomerReply(conversation, now = Date.now()) {
  if (conversation.status === SUPPORT_CONVERSATION_STATUS.CLOSED) return false;
  if (conversation.status === SUPPORT_CONVERSATION_STATUS.RESOLVED && conversation.resolvedAt) {
    return now - new Date(conversation.resolvedAt).getTime() <= SUPPORT_LIMITS.reopenWindowDays * DAY_MS;
  }
  return true;
}

/**
 * Status transition when the customer writes: a reply reopens a resolved
 * thread and hands a "waiting for customer" thread back to the team.
 * @param {string} status
 */
function statusAfterCustomerReply(status) {
  if (status === SUPPORT_CONVERSATION_STATUS.RESOLVED) {
    return { status: SUPPORT_CONVERSATION_STATUS.OPEN, resolvedAt: null };
  }
  if (status === SUPPORT_CONVERSATION_STATUS.WAITING_CUSTOMER) {
    return { status: SUPPORT_CONVERSATION_STATUS.IN_PROGRESS };
  }
  return {};
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

/**
 * Message DTO shared by the customer and admin thread views.
 * @param {Record<string, any>} message
 */
export function toThreadMessage(message) {
  const fromCustomer = message.senderRole === SUPPORT_SENDER_ROLE.CUSTOMER;
  /** @type {"customer" | "support" | "system"} */
  const sender = fromCustomer ? "customer" : message.senderRole === SUPPORT_SENDER_ROLE.SYSTEM ? "system" : "support";
  return {
    id: String(message._id),
    cursor: encodeMessageCursor(message),
    body: message.body,
    sender,
    createdAt: /** @type {string} */ (iso(message.createdAt)),
    clientMessageId: message.clientMessageId ?? null,
    /** Whether the other party has read it. */
    seen: fromCustomer ? Boolean(message.readByAdmin) : Boolean(message.readByCustomer),
  };
}

/**
 * @param {string | null | undefined} role
 * @returns {"customer" | "support" | null}
 */
export function toLastMessageFrom(role) {
  if (!role) return null;
  return role === SUPPORT_SENDER_ROLE.CUSTOMER ? "customer" : "support";
}

/**
 * @param {Record<string, any>} row
 * @param {Map<string, string>} [orderNumbers]
 */
export function toCustomerConversation(row, orderNumbers = new Map()) {
  const orderId = row.order ? String(row.order) : null;
  return {
    id: String(row._id),
    subject: row.subject,
    category: row.category ?? SUPPORT_CATEGORY.OTHER,
    status: toCustomerStatus(row.status),
    canReply: canCustomerReply(row),
    unreadCount: row.unreadByCustomer ?? 0,
    lastMessagePreview: row.lastMessagePreview ?? "",
    lastMessageFrom: toLastMessageFrom(row.lastMessageRole),
    lastMessageAt: iso(row.lastMessageAt ?? row.createdAt),
    createdAt: iso(row.createdAt),
    order: orderId ? { id: orderId, orderNumber: orderNumbers.get(orderId) ?? null } : null,
  };
}

async function loadOrderNumbers(rows) {
  const ids = [...new Set(rows.filter((row) => row.order).map((row) => String(row.order)))];
  if (!ids.length) return new Map();
  const orders = await Order.find({ _id: { $in: ids } }).select("orderNumber").lean();
  return new Map(orders.map((order) => [String(order._id), order.orderNumber]));
}

/**
 * Loads a conversation only if it belongs to `user`. Missing and foreign
 * conversations are indistinguishable (404) so ids cannot be probed.
 * @param {{ _id: unknown }} user
 * @param {string} conversationId
 * @param {string} [fields]
 */
async function findOwnedConversation(user, conversationId, fields = CUSTOMER_CONVERSATION_FIELDS) {
  if (!mongoose.isValidObjectId(conversationId)) throw new ApiError(404, "Conversation not found.");
  const conversation = await SupportConversation.findOne({ _id: conversationId, customer: user._id })
    .select(fields)
    .lean();
  if (!conversation) throw new ApiError(404, "Conversation not found.");
  return conversation;
}

/**
 * @param {{ _id: unknown }} user
 * @param {URLSearchParams} searchParams
 */
export async function listCustomerConversations(user, searchParams) {
  const pageRaw = Number(searchParams.get("page") ?? 1);
  const limitRaw = Number(searchParams.get("limit") ?? SUPPORT_LIMITS.conversationsPageDefault);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), SUPPORT_LIMITS.conversationsPageMax)
      : SUPPORT_LIMITS.conversationsPageDefault;

  const filter = { customer: user._id };
  const [rows, total, unreadConversations] = await Promise.all([
    SupportConversation.find(filter)
      .select(CUSTOMER_CONVERSATION_FIELDS)
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SupportConversation.countDocuments(filter),
    SupportConversation.countDocuments({ ...filter, unreadByCustomer: { $gt: 0 } }),
  ]);

  const [withPreviews, orderNumbers] = await Promise.all([backfillPreviews(rows), loadOrderNumbers(rows)]);
  return {
    items: withPreviews.map((row) => toCustomerConversation(row, orderNumbers)),
    meta: { ...buildPaginationMeta(total, page, limit), unreadConversations },
  };
}

/**
 * @param {{ _id: unknown }} user
 * @param {string} conversationId
 */
export async function getCustomerConversation(user, conversationId) {
  const conversation = await findOwnedConversation(user, conversationId);
  const orderNumbers = await loadOrderNumbers([conversation]);
  return toCustomerConversation(conversation, orderNumbers);
}

/**
 * @param {{ _id: unknown; name?: string; email?: string }} user
 * @param {unknown} payload
 */
export async function createCustomerConversation(user, payload) {
  const input = parseOrThrow(createSupportConversationSchema, payload);

  if (input.clientRequestId) {
    const existing = await SupportConversation.findOne({ customer: user._id, clientRequestId: input.clientRequestId })
      .select(CUSTOMER_CONVERSATION_FIELDS)
      .lean();
    if (existing) return { conversation: await withOrderNumber(existing), created: false };
  }

  if (input.orderId) {
    const owned = await Order.exists({ _id: input.orderId, customer: user._id });
    if (!owned) {
      throw new ApiError(422, "Please check the highlighted fields.", [
        { field: "orderId", message: "Choose one of your orders." },
      ]);
    }
  }

  const now = new Date();
  let conversation;
  try {
    conversation = await SupportConversation.create({
      customer: user._id,
      guestName: user.name ?? "",
      guestEmail: user.email ?? "",
      subject: input.subject,
      category: input.category,
      order: input.orderId,
      source: SUPPORT_SOURCE.ACCOUNT,
      status: SUPPORT_CONVERSATION_STATUS.OPEN,
      lastMessageAt: now,
      lastMessagePreview: messagePreview(input.message),
      lastMessageRole: SUPPORT_SENDER_ROLE.CUSTOMER,
      unreadByAdmin: 1,
      ...(input.clientRequestId ? { clientRequestId: input.clientRequestId } : {}),
    });
  } catch (error) {
    if (input.clientRequestId && /** @type {{ code?: number }} */ (error)?.code === 11000) {
      const winner = await SupportConversation.findOne({ customer: user._id, clientRequestId: input.clientRequestId })
        .select(CUSTOMER_CONVERSATION_FIELDS)
        .lean();
      if (winner) return { conversation: await withOrderNumber(winner), created: false };
    }
    throw error;
  }

  try {
    await SupportMessage.create({
      conversation: conversation._id,
      sender: user._id,
      senderRole: SUPPORT_SENDER_ROLE.CUSTOMER,
      body: input.message,
      readByAdmin: false,
      readByCustomer: true,
      createdAt: now,
    });
  } catch (error) {
    // No multi-document transaction here (works on standalone MongoDB too): undo the empty conversation.
    await SupportConversation.deleteOne({ _id: conversation._id }).catch(() => {});
    throw error;
  }

  return { conversation: await withOrderNumber(conversation.toObject()), created: true };
}

async function withOrderNumber(row) {
  return toCustomerConversation(row, await loadOrderNumbers([row]));
}

/**
 * @param {{ _id: unknown }} user
 * @param {string} conversationId
 * @param {URLSearchParams} searchParams
 */
export async function listCustomerMessages(user, conversationId, searchParams) {
  const conversation = await findOwnedConversation(user, conversationId);
  const { items, hasMore } = await findMessagesPage(conversation._id, {
    before: searchParams.get("before"),
    after: searchParams.get("after"),
    limit: parseMessageLimit(searchParams.get("limit")),
  });
  return {
    items: items.map(toThreadMessage),
    hasMore,
    conversation: toCustomerConversation(conversation, await loadOrderNumbers([conversation])),
  };
}

/**
 * @param {{ _id: unknown }} user
 * @param {string} conversationId
 * @param {unknown} payload
 */
export async function sendCustomerMessage(user, conversationId, payload) {
  const input = parseOrThrow(sendSupportMessageSchema, payload);
  const conversation = await findOwnedConversation(user, conversationId);

  if (!canCustomerReply(conversation)) {
    // A retry of a message that was stored before the thread closed is still a success.
    if (input.clientMessageId) {
      const stored = await SupportMessage.findOne({ conversation: conversation._id, clientMessageId: input.clientMessageId }).lean();
      if (stored) {
        return { message: toThreadMessage(stored), conversation: await withOrderNumber(conversation), created: false };
      }
    }
    throw new ApiError(409, "This conversation is closed. Start a new conversation if you still need help.");
  }

  const { message, created } = await insertSupportMessage({
    conversationId: conversation._id,
    senderRole: SUPPORT_SENDER_ROLE.CUSTOMER,
    sender: user._id,
    body: input.body,
    clientMessageId: input.clientMessageId,
  });

  const updated = created
    ? await recordConversationActivity(conversation._id, message, {
        set: statusAfterCustomerReply(conversation.status),
        projection: CUSTOMER_CONVERSATION_FIELDS,
      })
    : conversation;

  return { message: toThreadMessage(message), conversation: await withOrderNumber(updated ?? conversation), created };
}

/**
 * @param {{ _id: unknown }} user
 * @param {string} conversationId
 */
export async function markCustomerConversationRead(user, conversationId) {
  const conversation = await findOwnedConversation(user, conversationId, "_id");
  return markConversationRead(conversation._id, "customer");
}

/**
 * Customers may only close their own conversation; resolving, reopening and
 * priority changes belong to the support team.
 * @param {{ _id: unknown }} user
 * @param {string} conversationId
 * @param {unknown} payload
 */
export async function updateCustomerConversation(user, conversationId, payload) {
  const parsed = customerConversationUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(403, "Only the support team can change this conversation's status.");
  }
  const conversation = await findOwnedConversation(user, conversationId);
  if (conversation.status === SUPPORT_CONVERSATION_STATUS.CLOSED) return withOrderNumber(conversation);

  const updated = await SupportConversation.findOneAndUpdate(
    { _id: conversation._id, customer: user._id },
    { $set: { status: SUPPORT_CONVERSATION_STATUS.CLOSED } },
    { returnDocument: "after", projection: CUSTOMER_CONVERSATION_FIELDS },
  ).lean();
  return withOrderNumber(updated ?? conversation);
}
