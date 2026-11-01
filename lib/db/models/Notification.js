import mongoose from "mongoose";
import {
  ADMIN_AUDIENCE_VALUES,
  NOTIFICATION_ENTITY,
  NOTIFICATION_LIMITS,
  NOTIFICATION_RECIPIENT,
  NOTIFICATION_SEVERITY,
  NOTIFICATION_TYPE_VALUES,
} from "@/lib/constants/notifications";

const notificationSchema = new mongoose.Schema(
  {
    recipientType: { type: String, enum: Object.values(NOTIFICATION_RECIPIENT), required: true },
    /** Customer user id, admin user id, or the derived id of an env-only dashboard admin. */
    recipientId: { type: mongoose.Schema.Types.ObjectId, required: true },
    /** Admin permission scope; null for customer notifications. */
    audience: { type: String, enum: [...ADMIN_AUDIENCE_VALUES, null], default: null },
    type: { type: String, enum: NOTIFICATION_TYPE_VALUES, required: true },
    severity: { type: String, enum: Object.values(NOTIFICATION_SEVERITY), default: NOTIFICATION_SEVERITY.INFO },
    title: { type: String, required: true, trim: true, maxlength: NOTIFICATION_LIMITS.titleMax },
    message: { type: String, trim: true, maxlength: NOTIFICATION_LIMITS.messageMax, default: "" },
    entityType: { type: String, enum: [...Object.values(NOTIFICATION_ENTITY), null], default: null },
    entityId: { type: String, trim: true, maxlength: 64, default: null },
    /** App-relative path only; never an external URL. */
    url: { type: String, trim: true, maxlength: 300, default: "" },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    /**
     * Idempotency key for one business event per recipient (e.g. "order:<id>:paid").
     * Webhook retries and verify/webhook races collapse onto the same key.
     */
    dedupeKey: { type: String, trim: true, maxlength: 200 },
    /** Unread notifications sharing a group key are merged (e.g. several chat messages in one thread). */
    groupKey: { type: String, trim: true, maxlength: 200 },
    groupCount: { type: Number, default: 1, min: 1 },
    /** Small, non-sensitive display data (order number, status). Never payment or address details. */
    metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
    /** Out-of-band delivery state; in-app delivery never implies the email was sent. */
    email: {
      status: { type: String, enum: ["sent", "skipped", "failed"] },
      at: { type: Date },
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: true },
);

// Inbox listing, newest first, with a stable tie-breaker for cursor pagination.
notificationSchema.index({ recipientType: 1, recipientId: 1, createdAt: -1, _id: -1 });
// Unread counts and mark-all-read touch only the unread slice.
notificationSchema.index(
  { recipientType: 1, recipientId: 1, createdAt: -1 },
  { name: "unread_by_recipient", partialFilterExpression: { isRead: false } },
);
notificationSchema.index(
  { recipientType: 1, recipientId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } },
);
notificationSchema.index(
  { recipientType: 1, recipientId: 1, groupKey: 1 },
  { unique: true, name: "unread_group", partialFilterExpression: { isRead: false, groupKey: { $type: "string" } } },
);
// Retention: MongoDB removes notifications once expiresAt passes. Business audit
// trails (order status history, payments, webhook events) live elsewhere and are untouched.
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Notification =
  mongoose.models.Notification ?? mongoose.model("Notification", notificationSchema);
