import mongoose from "mongoose";
import { z } from "zod";
import {
  SUPPORT_CONVERSATION_STATUS,
  SUPPORT_PRIORITY,
  SupportConversation,
} from "@/lib/db/models/SupportConversation";
import { SUPPORT_SENDER_ROLE, SupportMessage } from "@/lib/db/models/SupportMessage";
import { Order } from "@/lib/db/models/Order";
import { User } from "@/lib/db/models/User";
import { SUPPORT_CATEGORY, SUPPORT_CATEGORY_VALUES, SUPPORT_SOURCE } from "@/lib/constants/support";
import {
  backfillPreviews,
  findMessagesPage,
  insertSupportMessage,
  markConversationRead,
  messagePreview,
  parseMessageLimit,
  recordConversationActivity,
} from "@/lib/repositories/support.repository";
import { toCustomerStatus, toLastMessageFrom, toThreadMessage } from "@/lib/services/support-chat.service";
import {
  onSupportAdminReply,
  onSupportConversationCreated,
  onSupportStatusChanged,
} from "@/lib/notifications/events";
import { ApiError } from "@/lib/utils/api-error";
import { escapeRegex } from "@/lib/utils/escape-regex";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { contactMessageSchema } from "@/lib/validators/contact.validator";
import { sendSupportMessageSchema } from "@/lib/validators/support.validator";

const CLOSED_STATUSES = [SUPPORT_CONVERSATION_STATUS.RESOLVED, SUPPORT_CONVERSATION_STATUS.CLOSED];

const ADMIN_LIST_FIELDS =
  "customer guestName guestEmail subject category source order status priority lastMessageAt lastMessagePreview lastMessageRole unreadByAdmin legacyContactId createdAt";

const adminUpdateSchema = z.object({
  status: z.enum(Object.values(SUPPORT_CONVERSATION_STATUS)).optional(),
  priority: z.enum(Object.values(SUPPORT_PRIORITY)).optional(),
  internalNotes: z.string().trim().max(4000).optional(),
  assignedAdmin: z
    .string()
    .refine((value) => mongoose.isValidObjectId(value), "Invalid admin.")
    .nullable()
    .optional(),
});

/**
 * Validates and stores a public contact form submission as a support conversation.
 * When the visitor is signed in, the conversation is linked to their account so
 * it also appears in their support inbox.
 * @param {unknown} payload
 * @param {{ customer?: { _id: unknown } | null }} [options]
 */
export async function submitContactMessage(payload, { customer = null } = {}) {
  const parsed = contactMessageSchema.safeParse(payload);
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "website")) {
      throw new ApiError(400, "We could not accept this message.");
    }
    throw new ApiError(422, "Please check the highlighted fields.", formatZodErrors(parsed.error));
  }

  const { website: _honeypot, ...input } = parsed.data;
  const conversation = await createSupportConversationFromContact(input, { customerId: customer?._id ?? null });
  return { input, messageId: String(conversation._id) };
}

export async function createSupportConversationFromContact(input, { customerId = null } = {}) {
  const now = new Date();
  const body = [input.message, input.phone ? `Phone: ${input.phone}` : ""].filter(Boolean).join("\n");
  const conversation = await SupportConversation.create({
    ...(customerId ? { customer: customerId } : {}),
    guestName: input.name,
    guestEmail: input.email,
    subject: input.subject,
    category: SUPPORT_CATEGORY.OTHER,
    source: SUPPORT_SOURCE.CONTACT,
    status: SUPPORT_CONVERSATION_STATUS.OPEN,
    priority: SUPPORT_PRIORITY.NORMAL,
    lastMessageAt: now,
    lastMessagePreview: messagePreview(body),
    lastMessageRole: SUPPORT_SENDER_ROLE.CUSTOMER,
    unreadByAdmin: 1,
  });

  await SupportMessage.create({
    conversation: conversation._id,
    sender: customerId,
    senderRole: SUPPORT_SENDER_ROLE.CUSTOMER,
    body,
    readByAdmin: false,
    readByCustomer: true,
  });

  onSupportConversationCreated(conversation, { preview: messagePreview(body), fromContactForm: true });
  return conversation;
}

/** Customer has written last and the thread is still active. */
function awaitingReplyFilter() {
  return {
    status: { $nin: CLOSED_STATUSES },
    $or: [
      { lastMessageRole: SUPPORT_SENDER_ROLE.CUSTOMER },
      // Conversations stored before lastMessageRole existed.
      { lastMessageRole: { $in: [null, ""] }, unreadByAdmin: { $gt: 0 } },
    ],
  };
}

function isAwaitingReply(row) {
  if (CLOSED_STATUSES.includes(row.status)) return false;
  if (row.lastMessageRole) return row.lastMessageRole === SUPPORT_SENDER_ROLE.CUSTOMER;
  return row.unreadByAdmin > 0;
}

/**
 * Resolves linked customers and orders for a page of conversations with one
 * query each (no per-row lookups).
 * @param {Record<string, any>[]} rows
 */
async function loadRelations(rows) {
  const customerIds = [...new Set(rows.filter((row) => row.customer).map((row) => String(row.customer)))];
  const orderIds = [...new Set(rows.filter((row) => row.order).map((row) => String(row.order)))];
  const [customers, orders] = await Promise.all([
    customerIds.length ? User.find({ _id: { $in: customerIds } }).select("name email phone companyName").lean() : [],
    orderIds.length ? Order.find({ _id: { $in: orderIds } }).select("orderNumber orderStatus").lean() : [],
  ]);
  return {
    customers: new Map(customers.map((row) => [String(row._id), row])),
    orders: new Map(orders.map((row) => [String(row._id), row])),
  };
}

function toAdminConversationRow(row, relations) {
  const customer = row.customer ? relations.customers.get(String(row.customer)) : null;
  const order = row.order ? relations.orders.get(String(row.order)) : null;
  return {
    id: String(row.legacyContactId ?? row._id),
    conversationId: String(row._id),
    customerId: row.customer ? String(row.customer) : null,
    name: customer?.name || row.guestName || "Customer",
    email: customer?.email || row.guestEmail || "",
    subject: row.subject,
    category: row.category ?? SUPPORT_CATEGORY.OTHER,
    source: row.source ?? SUPPORT_SOURCE.CONTACT,
    status: row.status,
    priority: row.priority,
    unread: row.unreadByAdmin > 0,
    unreadCount: row.unreadByAdmin ?? 0,
    awaitingReply: isAwaitingReply(row),
    lastMessageFrom: toLastMessageFrom(row.lastMessageRole),
    orderId: row.order ? String(row.order) : null,
    orderNumber: order?.orderNumber ?? null,
    preview: row.lastMessagePreview ?? "",
    createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: row.lastMessageAt?.toISOString?.() ?? row.updatedAt?.toISOString?.() ?? "",
  };
}

/**
 * @param {{
 *   status?: string;
 *   priority?: string;
 *   category?: string;
 *   view?: string;
 *   search?: string;
 *   page?: number;
 *   limit?: number;
 * }} [options]
 */
export async function listSupportConversations({ status, priority, category, view, search, page = 1, limit = 50 } = {}) {
  const filter = {};
  const and = [];
  if (status && Object.values(SUPPORT_CONVERSATION_STATUS).includes(status)) {
    filter.status = status;
  }
  if (priority && Object.values(SUPPORT_PRIORITY).includes(priority)) {
    filter.priority = priority;
  }
  if (category && SUPPORT_CATEGORY_VALUES.includes(category)) {
    filter.category = category === SUPPORT_CATEGORY.OTHER ? { $in: [SUPPORT_CATEGORY.OTHER, null] } : category;
  }
  if (view === "unread") filter.unreadByAdmin = { $gt: 0 };
  if (view === "awaiting") and.push(awaitingReplyFilter());
  if (search?.trim()) {
    const term = new RegExp(escapeRegex(search.trim().slice(0, 100)), "i");
    and.push({ $or: [{ subject: term }, { guestName: term }, { guestEmail: term }] });
  }
  if (and.length) filter.$and = and;

  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 50), 100);
  const safePage = Math.max(1, Math.floor(page) || 1);

  const [rows, total, unread, awaiting, open] = await Promise.all([
    SupportConversation.find(filter)
      .select(ADMIN_LIST_FIELDS)
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SupportConversation.countDocuments(filter),
    SupportConversation.countDocuments({ unreadByAdmin: { $gt: 0 } }),
    SupportConversation.countDocuments(awaitingReplyFilter()),
    SupportConversation.countDocuments({ status: { $nin: CLOSED_STATUSES } }),
  ]);

  const [withPreviews, relations] = await Promise.all([backfillPreviews(rows), loadRelations(rows)]);
  return {
    items: withPreviews.map((row) => toAdminConversationRow(row, relations)),
    meta: buildPaginationMeta(total, safePage, safeLimit),
    counts: { total: await SupportConversation.countDocuments({}), unread, awaiting, open },
  };
}

async function findConversationByIdentifier(identifier) {
  let conversation = null;
  if (mongoose.isValidObjectId(identifier)) {
    conversation = await SupportConversation.findById(identifier).lean();
  }
  if (!conversation && typeof identifier === "string" && identifier.length <= 64) {
    conversation = await SupportConversation.findOne({ legacyContactId: identifier }).lean();
  }
  if (!conversation) throw new ApiError(404, "Conversation not found.");
  return conversation;
}

async function toAdminConversationDetail(conversation) {
  const relations = await loadRelations([conversation]);
  const row = toAdminConversationRow(conversation, relations);
  const customer = conversation.customer ? relations.customers.get(String(conversation.customer)) : null;
  return {
    ...row,
    phone: customer?.phone || "",
    companyName: customer?.companyName || "",
    internalNotes: conversation.internalNotes ?? "",
    resolvedAt: conversation.resolvedAt?.toISOString?.() ?? null,
  };
}

/**
 * Loads a conversation with its latest page of messages and marks customer
 * messages as read by the team.
 * @param {string} identifier conversation id or legacy contact id
 */
export async function getSupportConversationDetail(identifier) {
  const conversation = await findConversationByIdentifier(identifier);
  const { items, hasMore } = await findMessagesPage(conversation._id, {});

  if (conversation.unreadByAdmin > 0) {
    await markConversationRead(conversation._id, "admin");
    conversation.unreadByAdmin = 0;
  }

  return {
    conversation: await toAdminConversationDetail(conversation),
    messages: items.map(toThreadMessage),
    hasMore,
  };
}

/**
 * @param {string} conversationId
 * @param {URLSearchParams} searchParams
 */
export async function listAdminConversationMessages(conversationId, searchParams) {
  const conversation = await findConversationByIdentifier(conversationId);
  const { items, hasMore } = await findMessagesPage(conversation._id, {
    before: searchParams.get("before"),
    after: searchParams.get("after"),
    limit: parseMessageLimit(searchParams.get("limit")),
  });
  return {
    items: items.map(toThreadMessage),
    hasMore,
    conversation: await toAdminConversationDetail(conversation),
  };
}

export async function markAdminConversationRead(conversationId) {
  const conversation = await findConversationByIdentifier(conversationId);
  return markConversationRead(conversation._id, "admin");
}

/**
 * @param {string} conversationId
 * @param {unknown} _adminUser
 * @param {unknown} payload
 */
export async function updateSupportConversation(conversationId, _adminUser, payload) {
  const parsed = adminUpdateSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new ApiError(422, "Please check the highlighted fields.", formatZodErrors(parsed.error));
  }
  const input = parsed.data;
  const conversation = await findConversationByIdentifier(conversationId);

  const set = {};
  if (input.status && input.status !== conversation.status) {
    set.status = input.status;
    set.resolvedAt = input.status === SUPPORT_CONVERSATION_STATUS.RESOLVED ? new Date() : null;
  }
  if (input.priority) set.priority = input.priority;
  if (input.internalNotes !== undefined) set.internalNotes = input.internalNotes;
  if (input.assignedAdmin !== undefined) set.assignedAdmin = input.assignedAdmin;

  const updated = Object.keys(set).length
    ? await SupportConversation.findOneAndUpdate({ _id: conversation._id }, { $set: set }, { returnDocument: "after" }).lean()
    : conversation;
  if (set.status && updated) {
    onSupportStatusChanged(updated, toCustomerStatus(conversation.status), toCustomerStatus(updated.status));
  }
  return toAdminConversationDetail(updated ?? conversation);
}

/**
 * @param {string} conversationId
 * @param {{ _id?: unknown } | null | undefined} adminUser
 * @param {unknown} body
 * @param {string} [clientMessageId]
 */
export async function addSupportAdminMessage(conversationId, adminUser, body, clientMessageId) {
  const parsed = sendSupportMessageSchema.safeParse({ body, clientMessageId });
  if (!parsed.success) {
    throw new ApiError(422, "Please check the highlighted fields.", formatZodErrors(parsed.error));
  }
  const conversation = await findConversationByIdentifier(conversationId);

  const { message, created } = await insertSupportMessage({
    conversationId: conversation._id,
    senderRole: SUPPORT_SENDER_ROLE.ADMIN,
    // Dashboard-only admin sessions have no user document.
    sender: adminUser?._id ?? null,
    body: parsed.data.body,
    clientMessageId: parsed.data.clientMessageId,
  });

  if (created) {
    const set = conversation.status === SUPPORT_CONVERSATION_STATUS.OPEN ? { status: SUPPORT_CONVERSATION_STATUS.IN_PROGRESS } : {};
    await recordConversationActivity(conversation._id, message, { set });
    onSupportAdminReply(conversation, messagePreview(message.body));
  }

  return { ...toThreadMessage(message), created };
}
