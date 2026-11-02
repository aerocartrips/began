import mongoose from "mongoose";
import { z } from "zod";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";
import { Quote } from "@/lib/db/models/Quote";
import { Product } from "@/lib/db/models/Product";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { QUOTE_ADMIN_TRANSITIONS, QUOTE_STATUS, QUOTE_STATUS_VALUES } from "@/lib/constants/quote-status";
import { SALES_MODE } from "@/lib/constants/sales-mode";
import { unitPriceFor, roundRupees } from "@/lib/catalog/pricing";
import { getActiveTenant, getStoreOrigin } from "@/lib/tenant/active";
import { sendTransactionalEmail } from "@/lib/services/email.service";
import { runAfterResponse } from "@/lib/utils/background";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id.");
const optionalText = (max) => z.string().trim().max(max).optional().default("");

const submitSchema = z.object({
  contact: z.object({
    name: z.string().trim().min(2, "Enter your name.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
    phone: optionalText(25),
    companyName: optionalText(160),
    gstin: z.string().trim().toUpperCase().regex(/^([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])?$/, "Enter a valid GSTIN or leave it blank.").optional().default(""),
  }),
  items: z
    .array(
      z.object({
        productId: objectId,
        variantId: objectId.nullish(),
        quantity: z.number().int().min(1).max(1000000),
        targetUnitPrice: z.number().min(0).nullish(),
        notes: optionalText(1000),
      }),
    )
    .min(1, "Add at least one product.")
    .max(50),
  message: optionalText(4000),
  requirements: z
    .object({
      customBranding: z.boolean().optional().default(false),
      customPackaging: z.boolean().optional().default(false),
      deliveryPincode: z.string().trim().regex(/^(\d{6})?$/, "Enter a 6-digit PIN code.").optional().default(""),
      neededBy: z.coerce.date().nullish(),
    })
    .optional()
    .default({}),
  // Honeypot: real visitors never fill this hidden field.
  website: z.string().max(0).optional(),
});

const parse = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const errors = formatZodErrors(parsed.error);
    throw new ApiError(422, errors[0]?.message ?? "Validation failed.", errors);
  }
  return parsed.data;
};

async function requireWholesaleStore() {
  const tenant = await getActiveTenant();
  if (tenant.salesMode !== SALES_MODE.WHOLESALE) throw new ApiError(404, "Quotes are not available for this store.");
  return tenant;
}

function quoteNumberFor(slug) {
  const prefix = slug.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "QTE";
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `${prefix}-Q${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/** Totals from offered prices (or list prices before the store has quoted). */
export function quoteTotals(quote) {
  const subtotal = roundRupees(
    quote.items.reduce((sum, item) => sum + (item.quotedUnitPrice ?? item.listUnitPrice) * item.quantity, 0),
  );
  const shipping = quote.response?.shippingCharges ?? 0;
  return { subtotal, shipping, total: roundRupees(subtotal + shipping) };
}

/** Buyer-safe view (no internal notes). */
export function toCustomerQuote(quote) {
  const doc = typeof quote.toObject === "function" ? quote.toObject() : quote;
  const expired = doc.status === QUOTE_STATUS.QUOTED && doc.response?.validUntil && new Date(doc.response.validUntil) < new Date();
  return {
    id: String(doc._id),
    quoteNumber: doc.quoteNumber,
    status: expired ? QUOTE_STATUS.EXPIRED : doc.status,
    contact: doc.contact,
    items: doc.items.map((item) => ({
      id: String(item._id),
      productId: String(item.product),
      variantId: item.variantId ? String(item.variantId) : null,
      productName: item.productName,
      productSlug: item.productSlug,
      sku: item.sku,
      colorName: item.colorName,
      quantity: item.quantity,
      targetUnitPrice: item.targetUnitPrice,
      listUnitPrice: item.listUnitPrice,
      quotedUnitPrice: item.quotedUnitPrice,
      notes: item.notes,
    })),
    message: doc.message,
    requirements: doc.requirements,
    response: {
      shippingCharges: doc.response?.shippingCharges ?? null,
      validUntil: doc.response?.validUntil ?? null,
      notes: doc.response?.notes ?? "",
      quotedAt: doc.response?.quotedAt ?? null,
    },
    totals: quoteTotals(doc),
    history: (doc.history ?? []).map(({ status, note, byRole, at }) => ({ status, note, byRole, at })),
    createdAt: doc.createdAt,
  };
}

/**
 * Creates a quote request from a signed-in or guest buyer.
 * @param {unknown} payload
 * @param {import("mongoose").Document | null} user
 */
export async function submitQuote(payload, user) {
  const tenant = await requireWholesaleStore();
  const data = parse(submitSchema, payload);
  if (data.website) throw new ApiError(400, "We could not accept this request.");

  const products = await Product.find({ _id: { $in: data.items.map((item) => item.productId) }, status: PRODUCT_STATUS.ACTIVE })
    .select("name slug sku variants price compareAtPrice wholesalePrice bulkPricingTiers minimumOrderQuantity")
    .lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));

  const items = data.items.map((item, index) => {
    const product = byId.get(item.productId);
    if (!product) throw new ApiError(422, "A product in your request is no longer available.", [{ field: `items.${index}.productId`, message: "Unavailable." }]);
    const variant = item.variantId ? product.variants?.find((entry) => String(entry._id) === item.variantId) : null;
    if (item.variantId && !variant) throw new ApiError(422, `Choose a valid colour for ${product.name}.`);
    return {
      product: product._id,
      variantId: variant?._id ?? null,
      productName: product.name,
      productSlug: product.slug,
      sku: variant?.sku ?? product.sku,
      colorName: variant?.colorName ?? "",
      quantity: item.quantity,
      targetUnitPrice: item.targetUnitPrice ?? null,
      listUnitPrice: unitPriceFor(product, item.quantity, SALES_MODE.WHOLESALE),
      notes: item.notes,
    };
  });

  const quote = await Quote.create({
    quoteNumber: quoteNumberFor(tenant.slug),
    customer: user?._id ?? null,
    contact: data.contact,
    items,
    message: data.message,
    requirements: { ...data.requirements, neededBy: data.requirements.neededBy ?? null },
    history: [{ status: QUOTE_STATUS.SUBMITTED, byRole: user ? "customer" : "system", by: user?._id ?? null }],
  });

  runAfterResponse("Quote notification", () => notifyStoreOfQuote(quote));
  return toCustomerQuote(quote);
}

async function notifyStoreOfQuote(quote) {
  const origin = await getStoreOrigin();
  const lines = quote.items.map((item) => `• ${item.quantity} × ${item.productName}${item.colorName ? ` (${item.colorName})` : ""}`).join("\n");
  await sendTransactionalEmail({
    subject: `New quote request ${quote.quoteNumber} from ${quote.contact.companyName || quote.contact.name}`,
    replyTo: quote.contact.email,
    text: `${quote.contact.name} (${quote.contact.email}) requested a quote:\n\n${lines}\n\nReview it: ${origin}/admin/quotes/${quote._id}`,
  });
}

export async function listCustomerQuotes(user) {
  const quotes = await Quote.find({ customer: user._id }).sort({ createdAt: -1 }).limit(100).lean();
  return quotes.map(toCustomerQuote);
}

async function findCustomerQuote(user, quoteId) {
  if (!mongoose.isValidObjectId(quoteId)) throw new ApiError(404, "Quote not found.");
  const quote = await Quote.findOne({ _id: quoteId, customer: user._id });
  if (!quote) throw new ApiError(404, "Quote not found.");
  return quote;
}

export async function getCustomerQuote(user, quoteId) {
  return toCustomerQuote(await findCustomerQuote(user, quoteId));
}

const respondSchema = z.object({ decision: z.enum(["accept", "decline"]), note: optionalText(1000) });

/** Buyer accepts or declines a quote the store has priced. */
export async function respondToQuote(user, quoteId, payload) {
  const { decision, note } = parse(respondSchema, payload);
  const quote = await findCustomerQuote(user, quoteId);
  if (quote.status !== QUOTE_STATUS.QUOTED) throw new ApiError(409, "This quote is not awaiting your response.");
  if (quote.response.validUntil && quote.response.validUntil < new Date()) {
    quote.status = QUOTE_STATUS.EXPIRED;
    quote.history.push({ status: QUOTE_STATUS.EXPIRED, byRole: "system" });
    await quote.save();
    throw new ApiError(409, "This quote has expired. Request a new one.");
  }
  quote.status = decision === "accept" ? QUOTE_STATUS.ACCEPTED : QUOTE_STATUS.DECLINED;
  quote.history.push({ status: quote.status, note, byRole: "customer", by: user._id });
  await quote.save();

  runAfterResponse("Quote response notification", () =>
    sendTransactionalEmail({
      subject: `Quote ${quote.quoteNumber} ${decision === "accept" ? "accepted" : "declined"} by ${quote.contact.companyName || quote.contact.name}`,
      replyTo: quote.contact.email,
      text: `${quote.contact.name} ${decision === "accept" ? "accepted" : "declined"} quote ${quote.quoteNumber}.${note ? `\n\nNote: ${note}` : ""}`,
    }),
  );
  return toCustomerQuote(quote);
}

/* ------------------------------------------------------------------ admin */

export async function listQuotesForAdmin(searchParams) {
  const { page, limit, skip } = parsePagination(searchParams);
  const filter = {};
  const status = searchParams.get("status");
  if (status && QUOTE_STATUS_VALUES.includes(status)) filter.status = status;
  const [items, total] = await Promise.all([
    Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("quoteNumber contact items status response createdAt").lean(),
    Quote.countDocuments(filter),
  ]);
  return {
    items: items.map((quote) => ({
      id: String(quote._id),
      quoteNumber: quote.quoteNumber,
      contact: quote.contact,
      itemCount: quote.items.length,
      pieces: quote.items.reduce((sum, item) => sum + item.quantity, 0),
      status: quote.status,
      totals: quoteTotals(quote),
      createdAt: quote.createdAt,
    })),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getQuoteForAdmin(quoteId) {
  if (!mongoose.isValidObjectId(quoteId)) throw new ApiError(404, "Quote not found.");
  const quote = await Quote.findById(quoteId).lean();
  if (!quote) throw new ApiError(404, "Quote not found.");
  return { ...toCustomerQuote(quote), internalNotes: quote.internalNotes ?? "" };
}

const adminUpdateSchema = z.object({
  status: z.enum(QUOTE_STATUS_VALUES).optional(),
  items: z.array(z.object({ id: objectId, quotedUnitPrice: z.number().min(0).nullable() })).max(50).optional(),
  shippingCharges: z.number().min(0).nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  responseNotes: z.string().trim().max(4000).optional(),
  internalNotes: z.string().trim().max(4000).optional(),
  note: optionalText(2000),
});

/**
 * Store team prices or progresses a quote. Moving to "quoted" requires a
 * price on every line and emails the buyer.
 */
export async function updateQuoteAsAdmin(quoteId, adminUser, payload) {
  const data = parse(adminUpdateSchema, payload);
  if (!mongoose.isValidObjectId(quoteId)) throw new ApiError(404, "Quote not found.");
  const quote = await Quote.findById(quoteId);
  if (!quote) throw new ApiError(404, "Quote not found.");

  for (const change of data.items ?? []) {
    const item = quote.items.id(change.id);
    if (item) item.quotedUnitPrice = change.quotedUnitPrice;
  }
  if (data.shippingCharges !== undefined) quote.response.shippingCharges = data.shippingCharges;
  if (data.validUntil !== undefined) quote.response.validUntil = data.validUntil;
  if (data.responseNotes !== undefined) quote.response.notes = data.responseNotes;
  if (data.internalNotes !== undefined) quote.internalNotes = data.internalNotes;

  const nextStatus = data.status ?? quote.status;
  if (nextStatus !== quote.status || nextStatus === QUOTE_STATUS.QUOTED) {
    const allowed = nextStatus === quote.status || QUOTE_ADMIN_TRANSITIONS[quote.status]?.includes(nextStatus);
    if (!allowed) throw new ApiError(409, `A ${quote.status} quote cannot move to ${nextStatus}.`);
  }
  const sendingQuote = nextStatus === QUOTE_STATUS.QUOTED && (quote.status !== QUOTE_STATUS.QUOTED || data.items?.length);
  if (nextStatus === QUOTE_STATUS.QUOTED) {
    if (quote.items.some((item) => item.quotedUnitPrice == null)) throw new ApiError(422, "Price every line before sending the quote.");
    if (!quote.response.validUntil) quote.response.validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    quote.response.quotedAt = new Date();
    quote.response.quotedBy = adminUser._id;
  }
  if (nextStatus !== quote.status || sendingQuote) {
    quote.history.push({ status: nextStatus, note: data.note, byRole: "admin", by: adminUser._id });
  }
  quote.status = nextStatus;
  await quote.save();

  if (sendingQuote) {
    const origin = await getStoreOrigin();
    const totals = quoteTotals(quote);
    runAfterResponse("Quote email", () =>
      sendTransactionalEmail({
        to: quote.contact.email,
        subject: `Your quote ${quote.quoteNumber} is ready`,
        text: `Hello ${quote.contact.name},\n\nYour quote ${quote.quoteNumber} is ready: ₹${totals.total.toFixed(2)} (excluding GST), valid until ${quote.response.validUntil.toLocaleDateString("en-IN")}.\n\n${quote.customer ? `Review and accept it: ${origin}/account/quotes/${quote._id}` : "Reply to this email to accept it."}`,
      }),
    );
  }
  return getQuoteForAdmin(quoteId);
}
