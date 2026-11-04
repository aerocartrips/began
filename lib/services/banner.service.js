import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { createBannerSchema, reorderBannersSchema, updateBannerSchema } from "@/lib/validators/banner.validator";
import { Banner } from "@/lib/db/models/Banner";

const MAX_BANNERS = 30;

const parse = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const errors = formatZodErrors(parsed.error);
    throw new ApiError(422, errors[0]?.message ?? "Validation failed.", errors);
  }
  return parsed.data;
};

/** Admin view of a banner, including its schedule state. */
export function toAdminBanner(doc, now = new Date()) {
  const banner = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const started = !banner.startsAt || new Date(banner.startsAt) <= now;
  const ended = banner.endsAt && new Date(banner.endsAt) <= now;
  return {
    id: String(banner._id),
    name: banner.name,
    eyebrow: banner.eyebrow,
    title: banner.title,
    subtitle: banner.subtitle,
    primaryCta: banner.primaryCta ?? { label: "", href: "" },
    secondaryCta: banner.secondaryCta ?? { label: "", href: "" },
    image: banner.image,
    mobileImage: banner.mobileImage ?? null,
    imageAlt: banner.imageAlt,
    textPosition: banner.textPosition,
    textTone: banner.textTone,
    overlayOpacity: banner.overlayOpacity,
    startsAt: banner.startsAt,
    endsAt: banner.endsAt,
    isActive: banner.isActive,
    sortOrder: banner.sortOrder,
    status: !banner.isActive ? "hidden" : ended ? "ended" : started ? "live" : "scheduled",
    updatedAt: banner.updatedAt,
  };
}

export async function listBanners() {
  const banners = await Banner.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return banners.map((banner) => toAdminBanner(banner));
}

async function findBanner(bannerId) {
  if (!mongoose.isValidObjectId(bannerId)) throw new ApiError(404, "Banner not found.");
  const banner = await Banner.findById(bannerId);
  if (!banner) throw new ApiError(404, "Banner not found.");
  return banner;
}

export async function getBanner(bannerId) {
  return toAdminBanner(await findBanner(bannerId));
}

/** New banners go to the end of the rotation. */
export async function createBanner(payload, adminUser) {
  const data = parse(createBannerSchema, payload);
  const count = await Banner.countDocuments({});
  if (count >= MAX_BANNERS) throw new ApiError(409, `A store can have up to ${MAX_BANNERS} banners. Delete old ones first.`);
  const last = await Banner.findOne({}).sort({ sortOrder: -1 }).select("sortOrder").lean();
  const banner = await Banner.create({ ...data, sortOrder: (last?.sortOrder ?? -1) + 1, updatedBy: adminUser._id });
  return toAdminBanner(banner);
}

export async function updateBanner(bannerId, payload, adminUser) {
  const data = parse(updateBannerSchema, payload);
  const banner = await findBanner(bannerId);
  Object.assign(banner, data, { updatedBy: adminUser._id });
  if (banner.startsAt && banner.endsAt && banner.startsAt >= banner.endsAt) {
    throw new ApiError(422, "The end date must be after the start date.", [{ field: "endsAt", message: "Must be after the start date." }]);
  }
  await banner.save();
  return toAdminBanner(banner);
}

export async function deleteBanner(bannerId) {
  const banner = await findBanner(bannerId);
  await banner.deleteOne();
  return { deleted: true, publicIds: [banner.image?.publicId, banner.mobileImage?.publicId].filter(Boolean) };
}

/** Saves the rotation order shown in the admin list (ids in display order). */
export async function reorderBanners(payload) {
  const { ids } = parse(reorderBannersSchema, payload);
  const result = await Banner.bulkWrite(ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: index } } } })));
  if (result.matchedCount !== ids.length) throw new ApiError(409, "The banner list changed. Reload and try again.");
  return listBanners();
}
