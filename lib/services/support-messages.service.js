import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
  SUPPORT_CONVERSATION_STATUS,
  SUPPORT_PRIORITY,
  SupportConversation,
} from "@/lib/db/models/SupportConversation";
import { SUPPORT_SENDER_ROLE, SupportMessage } from "@/lib/db/models/SupportMessage";
import { ApiError } from "@/lib/utils/api-error";

function legacyStorePath() {
  const configured = process.env.CONTACT_MESSAGES_FILE;
  if (configured) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }
  return resolve(process.cwd(), ".data", "contact-messages.json");
}

function mapLegacyStatus(status) {
  if (status === "archived") return SUPPORT_CONVERSATION_STATUS.CLOSED;
  if (status === "read") return SUPPORT_CONVERSATION_STATUS.RESOLVED;
  return SUPPORT_CONVERSATION_STATUS.OPEN;
}

export async function migrateLegacyContactMessages() {
  let raw;
  try {
    raw = await readFile(legacyStorePath(), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { imported: 0, skipped: 0 };
    throw error;
  }

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return { imported: 0, skipped: 0 };

  let imported = 0;
  let skipped = 0;

  for (const entry of parsed) {
    if (!entry?.id) continue;
    const exists = await SupportConversation.findOne({ legacyContactId: entry.id });
    if (exists) {
      skipped += 1;
      continue;
    }

    const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
    const conversation = await SupportConversation.create({
      guestName: entry.name ?? "Guest",
      guestEmail: entry.email ?? "",
      subject: entry.subject ?? "Contact form",
      status: mapLegacyStatus(entry.status),
      priority: SUPPORT_PRIORITY.NORMAL,
      lastMessageAt: createdAt,
      unreadByAdmin: entry.status === "new" ? 1 : 0,
      legacyContactId: entry.id,
      createdAt,
      updatedAt: createdAt,
    });

    const body = [entry.message, entry.phone ? `Phone: ${entry.phone}` : ""].filter(Boolean).join("\n");
    await SupportMessage.create({
      conversation: conversation._id,
      senderRole: SUPPORT_SENDER_ROLE.CUSTOMER,
      body,
      readByAdmin: entry.status !== "new",
      readByCustomer: true,
      legacyImported: true,
      createdAt,
    });
    imported += 1;
  }

  return { imported, skipped };
}

export async function createSupportConversationFromContact(input) {
  const now = new Date();
  const conversation = await SupportConversation.create({
    guestName: input.name,
    guestEmail: input.email,
    subject: input.subject,
    status: SUPPORT_CONVERSATION_STATUS.OPEN,
    priority: SUPPORT_PRIORITY.NORMAL,
    lastMessageAt: now,
    unreadByAdmin: 1,
  });

  const body = [input.message, input.phone ? `Phone: ${input.phone}` : ""].filter(Boolean).join("\n");
  await SupportMessage.create({
    conversation: conversation._id,
    senderRole: SUPPORT_SENDER_ROLE.CUSTOMER,
    body,
    readByAdmin: false,
    readByCustomer: true,
  });

  return conversation;
}

export async function listSupportConversations({ status, priority, search, limit = 50 } = {}) {
  await migrateLegacyContactMessages();

  const filter = {};
  if (status && Object.values(SUPPORT_CONVERSATION_STATUS).includes(status)) {
    filter.status = status;
  }
  if (priority && Object.values(SUPPORT_PRIORITY).includes(priority)) {
    filter.priority = priority;
  }
  if (search?.trim()) {
    const term = search.trim();
    filter.$or = [
      { subject: new RegExp(term, "i") },
      { guestName: new RegExp(term, "i") },
      { guestEmail: new RegExp(term, "i") },
    ];
  }

  const conversations = await SupportConversation.find(filter)
    .sort({ lastMessageAt: -1 })
    .limit(Math.min(limit, 100))
    .lean();

  const ids = conversations.map((row) => row._id);
  const latestMessages = await SupportMessage.aggregate([
    { $match: { conversation: { $in: ids } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$conversation", body: { $first: "$body" }, createdAt: { $first: "$createdAt" } } },
  ]);
  const previewMap = new Map(latestMessages.map((row) => [String(row._id), row]));

  return conversations.map((row) => {
    const preview = previewMap.get(String(row._id));
    return {
      id: String(row.legacyContactId ?? row._id),
      conversationId: String(row._id),
      name: row.guestName || "Customer",
      email: row.guestEmail || "",
      subject: row.subject,
      status: row.status,
      priority: row.priority,
      unread: row.unreadByAdmin > 0,
      preview: preview?.body?.slice(0, 160) ?? "",
      createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: row.lastMessageAt?.toISOString?.() ?? row.updatedAt?.toISOString?.() ?? "",
    };
  });
}

export async function getSupportConversationDetail(identifier) {
  await migrateLegacyContactMessages();

  let conversation = null;
  if (mongoose.isValidObjectId(identifier)) {
    conversation = await SupportConversation.findById(identifier);
  }
  if (!conversation) {
    conversation = await SupportConversation.findOne({ legacyContactId: identifier });
  }
  if (!conversation) throw new ApiError(404, "Conversation not found.");

  const messages = await SupportMessage.find({ conversation: conversation._id })
    .sort({ createdAt: 1 })
    .lean();

  if (conversation.unreadByAdmin > 0) {
    conversation.unreadByAdmin = 0;
    await SupportMessage.updateMany(
      { conversation: conversation._id, readByAdmin: false },
      { $set: { readByAdmin: true } },
    );
    await conversation.save();
  }

  return { conversation, messages };
}

export async function updateSupportConversation(conversationId, adminUser, payload) {
  const conversation = await SupportConversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, "Conversation not found.");

  if (payload.status && Object.values(SUPPORT_CONVERSATION_STATUS).includes(payload.status)) {
    conversation.status = payload.status;
  }
  if (payload.priority && Object.values(SUPPORT_PRIORITY).includes(payload.priority)) {
    conversation.priority = payload.priority;
  }
  if (payload.internalNotes !== undefined) {
    conversation.internalNotes = payload.internalNotes;
  }
  if (payload.assignedAdmin !== undefined) {
    conversation.assignedAdmin = payload.assignedAdmin;
  }
  await conversation.save();
  return conversation;
}

export async function addSupportAdminMessage(conversationId, adminUser, body) {
  const conversation = await SupportConversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, "Conversation not found.");
  const trimmed = body?.trim();
  if (!trimmed) throw new ApiError(422, "Message body is required.");

  const message = await SupportMessage.create({
    conversation: conversation._id,
    sender: adminUser._id,
    senderRole: SUPPORT_SENDER_ROLE.ADMIN,
    body: trimmed,
    readByAdmin: true,
    readByCustomer: false,
  });

  conversation.lastMessageAt = new Date();
  conversation.unreadByCustomer += 1;
  if (conversation.status === SUPPORT_CONVERSATION_STATUS.OPEN) {
    conversation.status = SUPPORT_CONVERSATION_STATUS.IN_PROGRESS;
  }
  await conversation.save();
  return message;
}
