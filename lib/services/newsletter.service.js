import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { NEWSLETTER_STATUS, NewsletterSubscriber } from "@/lib/db/models/NewsletterSubscriber";
import { isCustomerEmailConfigured, sendTransactionalEmail } from "@/lib/services/email.service";
import { getActiveTenant, getStoreOrigin } from "@/lib/tenant/active";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { escapeRegex } from "@/lib/utils/escape-regex";
import { ApiError } from "@/lib/utils/api-error";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";

/**
 * Newsletter sign-up with double opt-in: a sign-up is "pending" until the
 * shopper clicks the emailed link. If the platform cannot send email, a
 * sign-up is recorded as subscribed straight away (single opt-in, with the
 * consent time), so the form is never a dead end.
 *
 * Responses never reveal whether an address is already on the list.
 */

const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Confirmation emails per address per day, so the form cannot be used to spam someone. */
const EMAILS_PER_ADDRESS_PER_DAY = 3;

export const subscribeSchema = z.object({
  email: z
    .string({ error: "Enter a valid email address." })
    .trim()
    .toLowerCase()
    .max(254, "Enter a valid email address.")
    .email("Enter a valid email address."),
  source: z.string().trim().regex(/^[a-z0-9-]{0,40}$/).default("home"),
});

const tokenSchema = z.object({ token: z.string().trim().regex(/^[A-Za-z0-9_-]{20,100}$/, "This link is not valid.") });

const newToken = () => randomBytes(24).toString("base64url");
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");

function parse(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(422, issue?.message ?? "Validation failed.", parsed.error.issues.map((entry) => ({ field: entry.path.join("."), message: entry.message })));
  }
  return parsed.data;
}

async function sendConfirmation(email, confirmToken, unsubscribeToken) {
  const [{ name: storeName }, origin] = await Promise.all([getActiveTenant(), getStoreOrigin()]);
  const confirmUrl = `${origin}/newsletter/confirm?token=${confirmToken}`;
  const unsubscribeUrl = `${origin}/newsletter/unsubscribe?token=${unsubscribeToken}`;
  return sendTransactionalEmail({
    to: email,
    subject: `Confirm your subscription to ${storeName}`,
    text: `Hello,

Please confirm that you want news and new arrivals from ${storeName}:
${confirmUrl}

The link works for 7 days. If you did not sign up, ignore this email and you will not hear from us.

To stop receiving emails at any time: ${unsubscribeUrl}`,
  });
}

/**
 * @param {unknown} payload `{ email, source }`
 * @returns {Promise<{ status: "pending" | "subscribed" }>} what the shopper should be told
 */
export async function subscribeToNewsletter(payload) {
  const { email, source } = parse(subscribeSchema, payload);
  const doubleOptIn = isCustomerEmailConfigured();
  const reply = { status: doubleOptIn ? NEWSLETTER_STATUS.PENDING : NEWSLETTER_STATUS.SUBSCRIBED };
  const now = new Date();

  const existing = await NewsletterSubscriber.findOne({ email });
  if (existing?.status === NEWSLETTER_STATUS.SUBSCRIBED) return reply;

  if (!doubleOptIn) {
    await NewsletterSubscriber.findOneAndUpdate(
      { email },
      {
        $set: { status: NEWSLETTER_STATUS.SUBSCRIBED, source, consentAt: now, confirmedAt: now, unsubscribedAt: null },
        $unset: { confirmTokenHash: 1 },
        $setOnInsert: { unsubscribeTokenHash: hashToken(newToken()) },
      },
      { upsert: true },
    );
    return reply;
  }

  // Too many confirmation emails to this address today: answer the same, send nothing.
  const emailKey = `newsletter:email:${email}`;
  if (!(await checkRateLimit(emailKey, { limit: EMAILS_PER_ADDRESS_PER_DAY })).allowed) return reply;

  const confirmToken = newToken();
  const unsubscribeToken = newToken();
  await NewsletterSubscriber.findOneAndUpdate(
    { email },
    {
      $set: {
        status: NEWSLETTER_STATUS.PENDING,
        source,
        consentAt: now,
        confirmTokenHash: hashToken(confirmToken),
        confirmTokenExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
        // A fresh unsubscribe token per email, so links in older emails keep pointing at the same subscriber.
        unsubscribeTokenHash: hashToken(unsubscribeToken),
      },
    },
    { upsert: true },
  );
  await recordRateLimitHit(emailKey, { windowMs: DAY_MS });
  await sendConfirmation(email, confirmToken, unsubscribeToken);
  return reply;
}

/** @param {unknown} payload `{ token }` from the confirmation email */
export async function confirmNewsletter(payload) {
  const { token } = parse(tokenSchema, payload);
  const now = new Date();
  const subscriber = await NewsletterSubscriber.findOneAndUpdate(
    { confirmTokenHash: hashToken(token), confirmTokenExpiresAt: { $gt: now } },
    { $set: { status: NEWSLETTER_STATUS.SUBSCRIBED, confirmedAt: now, unsubscribedAt: null }, $unset: { confirmTokenHash: 1 } },
  );
  if (!subscriber) throw new ApiError(400, "This confirmation link has expired or was already used.");
  return { status: NEWSLETTER_STATUS.SUBSCRIBED };
}

/** @param {unknown} payload `{ token }` from any newsletter email */
export async function unsubscribeNewsletter(payload) {
  const { token } = parse(tokenSchema, payload);
  const subscriber = await NewsletterSubscriber.findOneAndUpdate(
    { unsubscribeTokenHash: hashToken(token) },
    { $set: { status: NEWSLETTER_STATUS.UNSUBSCRIBED, unsubscribedAt: new Date() }, $unset: { confirmTokenHash: 1 } },
  );
  if (!subscriber) throw new ApiError(400, "This unsubscribe link is not valid.");
  return { status: NEWSLETTER_STATUS.UNSUBSCRIBED };
}

const STATUS_FILTER = z.enum(Object.values(NEWSLETTER_STATUS)).optional().catch(undefined);

/**
 * Admin list (newest first). No tokens are ever returned.
 * @param {URLSearchParams} searchParams `status`, `q`, `page`, `limit`
 */
export async function listNewsletterSubscribers(searchParams) {
  const { page, limit, skip } = parsePagination(searchParams);
  const status = STATUS_FILTER.parse(searchParams.get("status") ?? undefined);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const filter = { ...(status ? { status } : {}), ...(q ? { email: { $regex: escapeRegex(q) } } : {}) };
  const [items, total, counts] = await Promise.all([
    NewsletterSubscriber.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).select("email status source consentAt confirmedAt unsubscribedAt createdAt").lean(),
    NewsletterSubscriber.countDocuments(filter),
    NewsletterSubscriber.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  return {
    items: items.map((item) => ({ ...item, _id: String(item._id) })),
    meta: { ...buildPaginationMeta(total, page, limit), counts: Object.fromEntries(counts.map((row) => [row._id, row.n])) },
  };
}

const csvCell = (value) => {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  // Neutralise spreadsheet formulas and quote every cell.
  return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
};

/** Confirmed subscribers as CSV, streamed in batches so large lists stay cheap. */
export async function exportSubscribersCsv() {
  const rows = ["email,status,source,consent_at,confirmed_at"];
  const cursor = NewsletterSubscriber.find({ status: NEWSLETTER_STATUS.SUBSCRIBED })
    .sort({ createdAt: 1 })
    .select("email status source consentAt confirmedAt")
    .lean()
    .cursor({ batchSize: 500 });
  for await (const row of cursor) {
    rows.push([row.email, row.status, row.source, row.consentAt, row.confirmedAt].map(csvCell).join(","));
  }
  return `${rows.join("\n")}\n`;
}
