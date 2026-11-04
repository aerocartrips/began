/**
 * TEST DATA ONLY. Adds 5 home page banners to a store, each with a desktop
 * (1920×800) and a mobile (1080×1350) image uploaded to the store's Cloudinary
 * banners folder.
 *
 *   npm run seed:test-banners -- --tenant norosilk          # add
 *   npm run seed:test-banners -- --tenant norosilk --remove # delete them again
 *
 * Banner names start with "TEST ·" and images carry the "norosilk-test-seed"
 * tag. Photos are generic stock images (picsum.photos), not real sarees.
 */
import { connect, disconnect, fail, parseCli } from "./lib/cli.mjs";
import { Tenant } from "@/lib/db/models/Tenant";
import { Banner } from "@/lib/db/models/Banner";
import { runWithTenant } from "@/lib/tenant/context";
import { getCloudinary } from "@/lib/cloudinary/config";
import { storeFolder, CLOUDINARY_FOLDERS } from "@/lib/constants/cloudinary-folders";

const TAG = "norosilk-test-seed";
const PREFIX = "TEST · ";

const args = parseCli(
  { tenant: { type: "string" }, remove: { type: "boolean", default: false } },
  "Usage: npm run seed:test-banners -- --tenant <slug> [--remove]",
);
if (!args.tenant) fail("--tenant is required.");

const day = 24 * 60 * 60 * 1000;
const BANNERS = [
  {
    name: "Festive Banarasi edit",
    eyebrow: "Festive 2026",
    title: "Banarasi silks woven for celebration",
    subtitle: "Pure zari brocades from Varanasi, with quantity pricing for retailers.",
    primaryCta: { label: "Shop Banarasi", href: "/categories/tst-banarasi-silk" },
    secondaryCta: { label: "Request a quote", href: "/request-quote" },
    imageAlt: "Woman in a deep red Banarasi silk saree with gold zari",
    textPosition: "left",
    textTone: "light",
    overlayOpacity: 40,
  },
  {
    name: "Bridal collection",
    eyebrow: "Bridal collection",
    title: "Heirloom sarees for the big day",
    subtitle: "Kanchipuram and Banarasi bridal weaves, hand-finished and ready to ship.",
    primaryCta: { label: "Explore bridal", href: "/categories/tst-bridal-collection" },
    secondaryCta: { label: "Talk to us", href: "/contact" },
    imageAlt: "Bride in a gold Kanchipuram silk saree",
    textPosition: "center",
    textTone: "light",
    overlayOpacity: 45,
  },
  {
    name: "Cotton handloom everyday",
    eyebrow: "Everyday handloom",
    title: "Breathable cottons for every day",
    subtitle: "Soft handloom cottons in easy colours, from ₹1,500.",
    primaryCta: { label: "Shop cottons", href: "/categories/tst-cotton-handloom" },
    secondaryCta: { label: "", href: "" },
    imageAlt: "Pastel handloom cotton sarees folded on a wooden table",
    textPosition: "right",
    textTone: "dark",
    overlayOpacity: 20,
  },
  {
    name: "Wholesale pricing",
    eyebrow: "For retailers",
    title: "Better prices the more you order",
    subtitle: "Quantity tiers on every saree, GST invoices and pan-India dispatch.",
    primaryCta: { label: "Browse catalogue", href: "/products" },
    secondaryCta: { label: "Get a quote", href: "/request-quote" },
    imageAlt: "Stacks of colourful silk sarees in a warehouse",
    textPosition: "left",
    textTone: "light",
    overlayOpacity: 50,
  },
  {
    name: "New arrivals, scheduled",
    eyebrow: "Just in",
    title: "New organza and chiffon arrivals",
    subtitle: "Light, sheer weaves for evening events. Live for the next 30 days.",
    primaryCta: { label: "See new arrivals", href: "/products?sort=newest" },
    secondaryCta: { label: "Organza", href: "/categories/tst-organza-sarees" },
    imageAlt: "Model in a sheer pastel organza saree",
    textPosition: "center",
    textTone: "light",
    overlayOpacity: 35,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 30 * day),
  },
];

async function upload(cloudinary, seed, width, height, folder, publicId) {
  const result = await cloudinary.uploader.upload(`https://picsum.photos/seed/${seed}/${width}/${height}`, {
    folder,
    public_id: publicId,
    overwrite: true,
    tags: [TAG],
    resource_type: "image",
  });
  return { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height };
}

await connect();
const tenant = await Tenant.findOne({ slug: args.tenant }).lean();
if (!tenant) fail(`No store with slug "${args.tenant}".`);
const cloudinary = getCloudinary();

await runWithTenant(String(tenant._id), async () => {
  const existing = await Banner.find({ name: { $regex: `^${PREFIX}` } }).lean();

  if (args.remove) {
    const publicIds = existing.flatMap((banner) => [banner.image?.publicId, banner.mobileImage?.publicId]).filter(Boolean);
    if (publicIds.length) await cloudinary.api.delete_resources(publicIds);
    const { deletedCount } = await Banner.deleteMany({ name: { $regex: `^${PREFIX}` } });
    process.stdout.write(`Removed ${deletedCount} test banners and ${publicIds.length} images.\n`);
    return;
  }
  if (existing.length) fail("Test banners already exist. Run with --remove first to recreate them.");

  const folder = storeFolder(CLOUDINARY_FOLDERS.banners);
  const images = await Promise.all(
    BANNERS.map(async (_, index) => ({
      image: await upload(cloudinary, `norosilk-banner-desktop-${index + 1}`, 1920, 800, folder, `test-banner-${index + 1}-desktop`),
      mobileImage: await upload(cloudinary, `norosilk-banner-mobile-${index + 1}`, 1080, 1350, folder, `test-banner-${index + 1}-mobile`),
    })),
  );

  const last = await Banner.findOne({}).sort({ sortOrder: -1 }).select("sortOrder").lean();
  const start = (last?.sortOrder ?? -1) + 1;
  await Banner.insertMany(
    BANNERS.map((banner, index) => ({
      ...banner,
      name: `${PREFIX}${banner.name}`,
      ...images[index],
      isActive: true,
      sortOrder: start + index,
    })),
  );
  process.stdout.write(`Added ${BANNERS.length} test banners (${BANNERS.length * 2} images) to ${tenant.slug}.\n`);
});

await disconnect();
