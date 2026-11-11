import { z } from "zod";
import { revalidateTag } from "next/cache";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { Tenant } from "@/lib/db/models/Tenant";
import { SALES_MODE_VALUES } from "@/lib/constants/sales-mode";
import { requireTenantId } from "@/lib/tenant/context";
import { invalidateTenantCache } from "@/lib/tenant/resolve";
import { catalogCacheTag } from "@/lib/catalog/catalog-cache";

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour.");
const url = z.union([z.string().trim().url().max(2048), z.literal("")]);
const email = z.union([z.string().trim().toLowerCase().email().max(254), z.literal("")]);
const dayCount = z.number().int().min(0).max(60);

/**
 * A search engine's site-verification token. Owners often paste the whole
 * <meta> tag Search Console or Bing gives them, so the content value is taken from it.
 */
const verificationToken = z
  .string()
  .trim()
  .max(400)
  .transform((value) => /content\s*=\s*["']([^"']*)["']/i.exec(value)?.[1]?.trim() ?? value)
  .refine((value) => !value || /^[\w-]{8,120}$/.test(value), "Paste the verification code (or the whole meta tag) from the search engine.");

/** Editable sections: store, branding, theme, contact, business and seo are stored on the Tenant; the rest on StoreSettings. */
const patchSchema = z
  .object({
    store: z.object({ name: z.string().trim().min(2).max(160), salesMode: z.enum(SALES_MODE_VALUES) }).partial().optional(),
    branding: z
      .object({
        siteTitle: z.string().trim().max(160),
        tagline: z.string().trim().max(240),
        description: z.string().trim().max(320),
        logoUrl: url,
        heroImageUrl: url,
        faviconUrl: url,
      })
      .partial()
      .optional(),
    theme: z
      .object({ brand: hex, brandSecondary: hex, accent: hex, text: hex, textMuted: hex, background: hex, surface: hex, border: hex })
      .partial()
      .optional(),
    contact: z
      .object({
        email,
        phone: z.string().trim().max(40),
        address: z.string().trim().max(500),
        hours: z.string().trim().max(160),
        instagram: url,
        linkedin: url,
        x: url,
      })
      .partial()
      .optional(),
    business: z
      .object({
        legalName: z.string().trim().max(200),
        gstin: z.string().trim().toUpperCase().max(15).refine((value) => !value || gstinRegex.test(value), "Invalid GSTIN format."),
        registeredAddress: z.string().trim().max(500),
        invoicePrefix: z.string().trim().toUpperCase().max(20),
        notificationEmail: email,
      })
      .partial()
      .optional(),
    commerce: z
      .object({
        defaultGstRatePercent: z.number().min(0).max(28),
        shippingFlatAmount: z.number().min(0).max(100000),
        shippingFreeThreshold: z.number().min(0).max(10000000),
        lowStockThreshold: z.number().int().min(0).max(100000),
        dispatchMinDays: dayCount,
        dispatchMaxDays: dayCount,
        transitMinDays: dayCount,
        transitMaxDays: dayCount,
      })
      .partial()
      .optional(),
    orders: z
      .object({
        paymentReservationMinutes: z.number().int().min(5).max(1440),
        cancellationWindowHours: z.number().int().min(0).max(720),
        returnWindowDays: z.number().int().min(0).max(90),
      })
      .partial()
      .optional(),
    seo: z
      .object({ googleSiteVerification: verificationToken, bingSiteVerification: verificationToken })
      .partial()
      .optional(),
    shipping: z
      .object({
        pickupLocationName: z.string().trim().max(160),
        pickupPincode: z.string().trim().max(12),
        defaultWeightKg: z.number().min(0.1).max(500),
        defaultBoxCount: z.number().int().min(1).max(100),
        freightMode: z.string().trim().max(40),
      })
      .partial()
      .optional(),
  })
  .strict();

const TENANT_FIELD_PATHS = {
  store: { name: "name", salesMode: "salesMode" },
  branding: Object.fromEntries(["siteTitle", "tagline", "description", "logoUrl", "heroImageUrl", "faviconUrl"].map((key) => [key, `branding.${key}`])),
  theme: Object.fromEntries(["brand", "brandSecondary", "accent", "text", "textMuted", "background", "surface", "border"].map((key) => [key, `branding.theme.${key}`])),
  contact: {
    email: "contact.email",
    phone: "contact.phone",
    address: "contact.address",
    hours: "contact.hours",
    instagram: "contact.social.instagram",
    linkedin: "contact.social.linkedin",
    x: "contact.social.x",
  },
  business: {
    legalName: "business.legalName",
    gstin: "business.gstin",
    registeredAddress: "business.registeredAddress",
    invoicePrefix: "business.invoicePrefix",
    notificationEmail: "notifications.email",
  },
  seo: {
    googleSiteVerification: "seo.googleSiteVerification",
    bingSiteVerification: "seo.bingSiteVerification",
  },
};

/** Combined view for Admin → Store settings (no integration secrets). */
export async function getStoreSettings() {
  const [tenant, settings] = await Promise.all([
    Tenant.findById(requireTenantId()).lean(),
    getStoreSettingsDocument(),
  ]);
  if (!tenant) throw new ApiError(404, "Store not found.");
  return {
    store: { name: tenant.name, salesMode: tenant.salesMode, domains: tenant.domains },
    branding: {
      siteTitle: tenant.branding?.siteTitle ?? "",
      tagline: tenant.branding?.tagline ?? "",
      description: tenant.branding?.description ?? "",
      logoUrl: tenant.branding?.logoUrl ?? "",
      heroImageUrl: tenant.branding?.heroImageUrl ?? "",
      faviconUrl: tenant.branding?.faviconUrl ?? "",
    },
    theme: { ...tenant.branding?.theme },
    contact: {
      email: tenant.contact?.email ?? "",
      phone: tenant.contact?.phone ?? "",
      address: tenant.contact?.address ?? "",
      hours: tenant.contact?.hours ?? "",
      instagram: tenant.contact?.social?.instagram ?? "",
      linkedin: tenant.contact?.social?.linkedin ?? "",
      x: tenant.contact?.social?.x ?? "",
    },
    business: {
      legalName: tenant.business?.legalName ?? "",
      gstin: tenant.business?.gstin ?? "",
      registeredAddress: tenant.business?.registeredAddress ?? "",
      invoicePrefix: tenant.business?.invoicePrefix ?? "INV",
      notificationEmail: tenant.notifications?.email ?? "",
    },
    seo: {
      googleSiteVerification: tenant.seo?.googleSiteVerification ?? "",
      bingSiteVerification: tenant.seo?.bingSiteVerification ?? "",
    },
    commerce: settings.commerce.toObject(),
    orders: settings.orders.toObject(),
    shipping: settings.shipping.toObject(),
    version: settings.version,
  };
}

export async function updateStoreSettings(adminUser, payload) {
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }
  const tenantId = requireTenantId();

  const tenantSet = {};
  for (const [section, paths] of Object.entries(TENANT_FIELD_PATHS)) {
    for (const [field, value] of Object.entries(parsed.data[section] ?? {})) tenantSet[paths[field]] = value;
  }
  if (Object.keys(tenantSet).length) {
    await Tenant.updateOne({ _id: tenantId }, { $set: tenantSet }, { runValidators: true });
    invalidateTenantCache(tenantId);
  }

  const doc = await getStoreSettingsDocument();
  for (const section of ["commerce", "orders", "shipping"]) {
    if (parsed.data[section]) Object.assign(doc[section], parsed.data[section]);
  }
  for (const [label, from, to] of [
    ["Dispatch time", "dispatchMinDays", "dispatchMaxDays"],
    ["Delivery time", "transitMinDays", "transitMaxDays"],
  ]) {
    if (doc.commerce[from] > doc.commerce[to] && doc.commerce[to] > 0) {
      throw new ApiError(422, "Validation failed.", [{ field: `commerce.${from}`, message: `${label}: "from" can't be more than "to".` }]);
    }
  }
  doc.version += 1;
  doc.updatedBy = adminUser._id;
  await doc.save();

  // Default policy pages quote the order windows; prices shown depend on the sales mode.
  revalidateTag(`pages:${tenantId}`, { expire: 0 });
  revalidateTag(catalogCacheTag(tenantId), { expire: 0 });
  return getStoreSettings();
}
