import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { homepageLayoutSchema } from "@/lib/validators/homepage.validator";
import { HomepageLayout } from "@/lib/db/models/HomepageLayout";
import { defaultHomeSections, normalizeHomeSections } from "@/lib/content/homepage-defaults";
import { DEFAULT_SECTION_PRODUCTS, MAX_SECTION_PRODUCTS } from "@/lib/constants/homepage";

/**
 * Home page layout for the current store (Admin → Home page). A store without
 * a saved layout uses defaultHomeSections().
 */

/** Plain, JSON-safe sections from a stored layout. */
export function toHomeSections(doc) {
  return (doc?.sections ?? []).map((section) => {
    const plain = typeof section.toObject === "function" ? section.toObject() : section;
    return {
      key: plain.key,
      type: plain.type,
      enabled: plain.enabled,
      title: plain.title ?? "",
      description: plain.description ?? "",
      // Layouts saved before the cap was lowered may hold up to 24.
      limit: Math.min(plain.limit ?? DEFAULT_SECTION_PRODUCTS, MAX_SECTION_PRODUCTS),
      viewAllHref: plain.viewAllHref ?? "",
      showOnMobile: plain.showOnMobile ?? true,
      showOnDesktop: plain.showOnDesktop ?? true,
      ...(plain.type === "collection" && plain.source
        ? {
            source: {
              kind: plain.source.kind,
              value: plain.source.value ?? "",
              productIds: (plain.source.productIds ?? []).map(String),
              sort: plain.source.sort ?? "popular",
            },
          }
        : {}),
      ...(plain.tabs?.length ? { tabs: [...plain.tabs] } : {}),
      ...(plain.items ? { items: plain.items.map(({ icon, title, text }) => ({ icon, title, text })) } : {}),
      ...(plain.primaryCta ? { primaryCta: { label: plain.primaryCta.label, href: plain.primaryCta.href } } : {}),
      ...(plain.secondaryCta ? { secondaryCta: { label: plain.secondaryCta.label, href: plain.secondaryCta.href } } : {}),
    };
  });
}

/** @returns {Promise<import("@/features/homepage/types").AdminHomepageLayout>} */
export async function getAdminHomepageLayout() {
  const doc = await HomepageLayout.findOne({}).lean();
  return doc
    ? { sections: normalizeHomeSections(toHomeSections(doc)), isDefault: false, updatedAt: doc.updatedAt?.toISOString?.() ?? null }
    : { sections: defaultHomeSections(), isDefault: true, updatedAt: null };
}

export async function saveHomepageLayout(payload, adminUser) {
  const parsed = homepageLayoutSchema.safeParse(payload);
  if (!parsed.success) {
    const errors = formatZodErrors(parsed.error);
    throw new ApiError(422, errors[0]?.message ?? "Validation failed.", errors);
  }
  await HomepageLayout.findOneAndUpdate(
    {},
    { $set: { sections: normalizeHomeSections(parsed.data.sections), updatedBy: adminUser._id } },
    { upsert: true, runValidators: true },
  );
  return getAdminHomepageLayout();
}

/** Goes back to the default layout. */
export async function resetHomepageLayout() {
  await HomepageLayout.deleteOne({});
  return getAdminHomepageLayout();
}
