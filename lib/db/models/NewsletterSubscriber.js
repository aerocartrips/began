import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

export const NEWSLETTER_STATUS = { PENDING: "pending", SUBSCRIBED: "subscribed", UNSUBSCRIBED: "unsubscribed" };

/**
 * A store's newsletter subscriber. Only the email address and consent
 * timestamps are kept. Tokens are stored as SHA-256 hashes, so a database
 * leak cannot be used to confirm or cancel anyone's subscription.
 */
const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    status: { type: String, enum: Object.values(NEWSLETTER_STATUS), default: NEWSLETTER_STATUS.PENDING },
    /** Where the shopper signed up, e.g. "home". */
    source: { type: String, trim: true, maxlength: 40, default: "" },
    consentAt: { type: Date, required: true },
    confirmedAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },
    confirmTokenHash: { type: String, default: undefined },
    confirmTokenExpiresAt: { type: Date, default: null },
    unsubscribeTokenHash: { type: String, required: true },
  },
  { timestamps: true },
);

newsletterSubscriberSchema.index({ tenantId: 1, email: 1 }, { unique: true });
newsletterSubscriberSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
newsletterSubscriberSchema.index({ tenantId: 1, confirmTokenHash: 1 }, { partialFilterExpression: { confirmTokenHash: { $type: "string" } } });
newsletterSubscriberSchema.index({ tenantId: 1, unsubscribeTokenHash: 1 });

newsletterSubscriberSchema.plugin(tenantScopePlugin);

export const NewsletterSubscriber =
  mongoose.models.NewsletterSubscriber ?? mongoose.model("NewsletterSubscriber", newsletterSubscriberSchema);
