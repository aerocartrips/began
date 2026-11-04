import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { createGuideSchema, updateGuideSchema } from "@/lib/validators/guide.validator";
import { GUIDE_STATUS, Guide } from "@/lib/db/models/Guide";
import { slugify } from "@/lib/utils/slugify";

/** Buying guides for the current store (Admin → Buying guides). */

const MAX_GUIDES = 500;

const parse = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const errors = formatZodErrors(parsed.error);
    throw new ApiError(422, errors[0]?.message ?? "Validation failed.", errors);
  }
  return parsed.data;
};

/** Words in all sections, at 200 words a minute, rounded up (at least 1). */
export function readingMinutes(sections = []) {
  const words = sections.reduce((total, section) => total + `${section.heading} ${section.body}`.split(/\s+/).filter(Boolean).length, 0);
  return Math.max(1, Math.ceil(words / 200));
}

export function toAdminGuide(doc) {
  const guide = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(guide._id),
    title: guide.title,
    slug: guide.slug,
    excerpt: guide.excerpt ?? "",
    coverImage: guide.coverImage ?? null,
    coverAlt: guide.coverAlt ?? "",
    sections: (guide.sections ?? []).map(({ heading, body }) => ({ heading, body })),
    status: guide.status,
    publishedAt: guide.publishedAt,
    updatedAt: guide.updatedAt,
    readingMinutes: readingMinutes(guide.sections),
  };
}

export async function listGuides() {
  const guides = await Guide.find({}).sort({ updatedAt: -1 }).select("title slug status publishedAt updatedAt sections coverImage").lean();
  return guides.map((guide) => toAdminGuide(guide));
}

async function findGuide(guideId) {
  if (!mongoose.isValidObjectId(guideId)) throw new ApiError(404, "Guide not found.");
  const guide = await Guide.findById(guideId);
  if (!guide) throw new ApiError(404, "Guide not found.");
  return guide;
}

export async function getGuide(guideId) {
  return toAdminGuide(await findGuide(guideId));
}

async function assertSlugFree(slug, exceptId = null) {
  const clash = await Guide.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (clash) throw new ApiError(409, "Another guide already uses this web address.", [{ field: "slug", message: "Choose a different web address." }]);
}

export async function createGuide(payload, adminUser) {
  const data = parse(createGuideSchema, payload);
  if ((await Guide.countDocuments({})) >= MAX_GUIDES) throw new ApiError(409, `A store can have up to ${MAX_GUIDES} guides.`);
  const slug = data.slug || slugify(data.title).slice(0, 90);
  if (!slug) throw new ApiError(422, "Add a web address for the guide.", [{ field: "slug", message: "Required." }]);
  await assertSlugFree(slug);
  const guide = await Guide.create({
    ...data,
    slug,
    publishedAt: data.status === GUIDE_STATUS.PUBLISHED ? new Date() : null,
    updatedBy: adminUser._id,
  });
  return toAdminGuide(guide);
}

export async function updateGuide(guideId, payload, adminUser) {
  const data = parse(updateGuideSchema, payload);
  const guide = await findGuide(guideId);
  if (data.slug && data.slug !== guide.slug) await assertSlugFree(data.slug, guide._id);
  Object.assign(guide, data, { updatedBy: adminUser._id });
  if (guide.status === GUIDE_STATUS.PUBLISHED) {
    if (!guide.sections.length) throw new ApiError(422, "Add at least one section before publishing.", [{ field: "sections", message: "Required." }]);
    guide.publishedAt ??= new Date();
  }
  await guide.save();
  return toAdminGuide(guide);
}

export async function deleteGuide(guideId) {
  const guide = await findGuide(guideId);
  await guide.deleteOne();
  return { deleted: true, publicIds: [guide.coverImage?.publicId].filter(Boolean) };
}
