import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { BUILD_PLACEHOLDER_DOMAIN } from "@/lib/tenant/host";
import { Tenant } from "@/lib/db/models/Tenant";
import { decryptSecret } from "@/lib/tenant/secrets";

export const TENANTS_CACHE_TAG = "tenants";

/** @param {string} tenantId */
export const tenantCacheTag = (tenantId) => `tenant:${tenantId}`;

/**
 * Browser-safe tenant configuration (no integration secrets).
 * @param {Record<string, any>} doc lean Tenant document
 * @returns {import("@/lib/tenant/types").PublicTenant}
 */
export function toPublicTenant(doc) {
  const branding = doc.branding ?? {};
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    primaryDomain: doc.domains[0],
    salesMode: doc.salesMode,
    branding: {
      siteTitle: branding.siteTitle || doc.name,
      tagline: branding.tagline ?? "",
      description: branding.description ?? "",
      logoUrl: branding.logoUrl ?? "",
      heroImageUrl: branding.heroImageUrl ?? "",
      faviconUrl: branding.faviconUrl ?? "",
      theme: { ...branding.theme },
    },
    contact: {
      email: doc.contact?.email ?? "",
      phone: doc.contact?.phone ?? "",
      address: doc.contact?.address ?? "",
      hours: doc.contact?.hours ?? "",
      social: { ...doc.contact?.social },
    },
    business: {
      legalName: doc.business?.legalName || doc.name,
      gstin: doc.business?.gstin ?? "",
      registeredAddress: doc.business?.registeredAddress ?? "",
      invoicePrefix: doc.business?.invoicePrefix || "INV",
    },
    notificationEmail: doc.notifications?.email || doc.contact?.email || "",
    razorpayKeyId: doc.integrations?.razorpay?.keyId ?? "",
    seo: {
      googleSiteVerification: doc.seo?.googleSiteVerification ?? "",
      bingSiteVerification: doc.seo?.bingSiteVerification ?? "",
    },
  };
}

/**
 * Active store serving `domain`, cached until its settings change.
 * @param {string} domain normalised hostname
 */
export async function getTenantByDomain(domain) {
  "use cache";
  cacheTag(TENANTS_CACHE_TAG);

  const doc =
    isDatabaseConfigured() && domain !== BUILD_PLACEHOLDER_DOMAIN
      ? await connectDB().then(() => Tenant.findOne({ domains: domain, status: "active" }).lean())
      : null;

  if (!doc) {
    // Short-lived miss so a newly added domain starts working quickly.
    cacheLife("minutes");
    return null;
  }
  cacheLife("hours");
  cacheTag(tenantCacheTag(String(doc._id)));
  return toPublicTenant(doc);
}

/**
 * @param {string} tenantId
 */
export async function getTenantById(tenantId) {
  "use cache";
  cacheLife("hours");
  cacheTag(TENANTS_CACHE_TAG, tenantCacheTag(tenantId));

  await connectDB();
  const doc = await Tenant.findOne({ _id: tenantId, status: "active" }).lean();
  return doc ? toPublicTenant(doc) : null;
}

/** All active stores, for platform jobs and build-time params. */
export async function listActiveTenants() {
  await connectDB();
  const docs = await Tenant.find({ status: "active" }).sort({ createdAt: 1 }).lean();
  return docs.map(toPublicTenant);
}

/**
 * Decrypted integration credentials. Never cached and never returned to clients.
 * @param {string} tenantId
 */
export async function getTenantIntegrations(tenantId) {
  await connectDB();
  const doc = await Tenant.findById(tenantId)
    .select("+integrations.razorpay.keySecret +integrations.razorpay.webhookSecret +integrations.delhivery.apiToken +integrations.delhivery.b2bPassword")
    .lean();
  const integrations = doc?.integrations ?? {};
  return {
    razorpay: {
      keyId: integrations.razorpay?.keyId ?? "",
      keySecret: decryptSecret(integrations.razorpay?.keySecret),
      webhookSecret: decryptSecret(integrations.razorpay?.webhookSecret),
    },
    delhivery: {
      apiToken: decryptSecret(integrations.delhivery?.apiToken),
      b2bUsername: integrations.delhivery?.b2bUsername ?? "",
      b2bPassword: decryptSecret(integrations.delhivery?.b2bPassword),
    },
  };
}

/**
 * Call after editing a store's settings so every cached read refreshes.
 * @param {string} tenantId
 */
export function invalidateTenantCache(tenantId) {
  revalidateTag(tenantCacheTag(tenantId), { expire: 0 });
}
