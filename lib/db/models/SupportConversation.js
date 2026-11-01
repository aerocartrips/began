import mongoose from "mongoose";
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
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
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
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    status: {
      type: String,
      enum: Object.values(SUPPORT_CONVERSATION_STATUS),
      default: SUPPORT_CONVERSATION_STATUS.OPEN,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(SUPPORT_PRIORITY),
      default: SUPPORT_PRIORITY.NORMAL,
      index: true,
    },
    assignedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    internalNotes: { type: String, trim: true, maxlength: 4000, default: "" },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, maxlength: 200, default: "" },
    lastMessageRole: { type: String, enum: ["customer", "admin", "system", ""], default: "" },
    resolvedAt: { type: Date, default: null },
    /** Client-generated key so a retried "start conversation" request does not create duplicates. */
    clientRequestId: { type: String, trim: true, maxlength: 64 },
    unreadByAdmin: { type: Number, default: 0, min: 0 },
    unreadByCustomer: { type: Number, default: 0, min: 0 },
    legacyContactId: { type: String, trim: true, maxlength: 64, index: true, sparse: true },
  },
  { timestamps: true },
);

conversationSchema.index({ status: 1, lastMessageAt: -1 });
conversationSchema.index({ customer: 1, updatedAt: -1 });
conversationSchema.index({ customer: 1, lastMessageAt: -1, _id: -1 });
conversationSchema.index(
  { customer: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } },
);

export const SupportConversation =
  mongoose.models.SupportConversation ??
  mongoose.model("SupportConversation", conversationSchema);
