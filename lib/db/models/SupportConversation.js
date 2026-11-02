import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { SUPPORT_CATEGORY, SUPPORT_CATEGORY_VALUES, SUPPORT_SOURCE } from "@/lib/constants/support";

export const SUPPORT_CONVERSATION_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  WAITING_CUSTOMER: "waiting_customer",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

export const SUPPORT_PRIORITY = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
};

const conversationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    guestEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
    guestName: { type: String, trim: true, maxlength: 120, default: "" },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: SUPPORT_CATEGORY_VALUES,
      default: SUPPORT_CATEGORY.OTHER,
    },
    source: {
      type: String,
      enum: Object.values(SUPPORT_SOURCE),
      default: SUPPORT_SOURCE.CONTACT,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    status: {
      type: String,
      enum: Object.values(SUPPORT_CONVERSATION_STATUS),
      default: SUPPORT_CONVERSATION_STATUS.OPEN,
    },
    priority: {
      type: String,
      enum: Object.values(SUPPORT_PRIORITY),
      default: SUPPORT_PRIORITY.NORMAL,
    },
    assignedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    internalNotes: { type: String, trim: true, maxlength: 4000, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, maxlength: 200, default: "" },
    lastMessageRole: { type: String, enum: ["customer", "admin", "system", ""], default: "" },
    resolvedAt: { type: Date, default: null },
    /** Client-generated key so a retried "start conversation" request does not create duplicates. */
    clientRequestId: { type: String, trim: true, maxlength: 64 },
    unreadByAdmin: { type: Number, default: 0, min: 0 },
    unreadByCustomer: { type: Number, default: 0, min: 0 },
    legacyContactId: { type: String, trim: true, maxlength: 64 },
  },
  { timestamps: true },
);

conversationSchema.index({ tenantId: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, customer: 1, updatedAt: -1 });
conversationSchema.index({ tenantId: 1, customer: 1, lastMessageAt: -1, _id: -1 });
conversationSchema.index(
  { tenantId: 1, customer: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } },
);

conversationSchema.index({ tenantId: 1, order: 1 });
conversationSchema.index({ tenantId: 1, assignedAdmin: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, legacyContactId: 1 }, { partialFilterExpression: { legacyContactId: { $type: "string" } } });
conversationSchema.plugin(tenantScopePlugin);

export const SupportConversation =
  mongoose.models.SupportConversation ??
  mongoose.model("SupportConversation", conversationSchema);
