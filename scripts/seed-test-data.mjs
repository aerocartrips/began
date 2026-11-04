/**
 * TEST DATA ONLY. Adds 20 categories and 100 fully filled products (colour
 * variants, quantity tiers, GST/HSN, SEO, photos) to one store, with images
 * uploaded to the store's Cloudinary folder.
 *
 *   npm run seed:test -- --tenant norosilk          # add
 *   npm run seed:test -- --tenant norosilk --remove # delete everything this script added
 *
 * Everything is marked so it can be removed cleanly: product SKUs start with
 * "TST-", category slugs with "tst-", and every image carries the Cloudinary tag
 * below. Photos are generic stock images (picsum.photos), not real sarees.
 */
import { connect, disconnect, fail, parseCli } from "./lib/cli.mjs";
import { Tenant } from "@/lib/db/models/Tenant";
import { Attribute } from "@/lib/db/models/Attribute";
import { Category } from "@/lib/db/models/Category";
import { Product } from "@/lib/db/models/Product";
import { runWithTenant } from "@/lib/tenant/context";
import { getCloudinary } from "@/lib/cloudinary/config";
import { storeFolder, CLOUDINARY_FOLDERS } from "@/lib/constants/cloudinary-folders";
import { mapUploadResult } from "@/lib/cloudinary/transformations";
import { slugify } from "@/lib/utils/slugify";

const TAG = "norosilk-test-seed";
const PRODUCT_COUNT = 100;
const PRODUCT_IMAGE_POOL = 40;

const args = parseCli(
  { tenant: { type: "string" }, remove: { type: "boolean", default: false } },
  "Usage: npm run seed:test -- --tenant <slug> [--remove]",
);
if (!args.tenant) fail("--tenant is required.");

const CATEGORIES = [
  ["Banarasi Silk", "Rich Varanasi silks with intricate zari brocade."],
  ["Kanchipuram Silk", "Temple-border silks woven in Tamil Nadu."],
  ["Paithani", "Maharashtrian silks with peacock pallus."],
  ["Chanderi", "Light, sheer silk-cotton from Madhya Pradesh."],
  ["Jamdani", "Hand-woven muslin with floating motifs from Bengal."],
  ["Patola", "Double-ikat silks from Patan, Gujarat."],
  ["Bandhani", "Tie-dye sarees from Gujarat and Rajasthan."],
  ["Tussar Silk", "Textured wild silk with a natural sheen."],
  ["Mysore Silk", "Pure crepe silks with a soft drape."],
  ["Pochampally Ikat", "Geometric ikat weaves from Telangana."],
  ["Sambalpuri", "Handloom ikat sarees from Odisha."],
  ["Baluchari", "Mythological pallus woven in Bishnupur."],
  ["Kota Doria", "Airy chequered weaves from Kota."],
  ["Linen Sarees", "Easy-care linen for work and travel."],
  ["Organza Sarees", "Crisp, sheer sarees for festive evenings."],
  ["Georgette Sarees", "Flowing georgette for parties and receptions."],
  ["Chiffon Sarees", "Featherlight chiffons with prints and borders."],
  ["Cotton Handloom", "Breathable everyday handloom cottons."],
  ["Bridal Collection", "Heavy zari and embroidered sarees for weddings."],
  ["Designer Party Wear", "Statement sarees with sequins and embellishment."],
];
const FABRICS = ["Pure Silk", "Silk Cotton", "Cotton", "Linen", "Organza", "Georgette", "Chiffon", "Tussar Silk", "Crepe Silk"];
const WEAVES = ["Banarasi", "Kanchipuram", "Chanderi", "Paithani", "Jamdani", "Ikat", "Bandhani", "Handloom", "Baluchari"];
const OCCASIONS = ["Wedding", "Festive", "Party", "Office", "Daily wear"];
const PATTERNS = ["Zari border", "Buta", "Floral", "Checks", "Temple border", "Plain body", "Peacock motif"];
const COLOURS = [
  ["Ruby Red", "#9b111e"], ["Emerald Green", "#046307"], ["Royal Blue", "#1d3f91"], ["Mustard", "#d4a017"],
  ["Ivory", "#f3eadb"], ["Black", "#1b1b1b"], ["Magenta", "#b0126f"], ["Peach", "#f4a582"],
  ["Teal", "#08757a"], ["Wine", "#5e1224"], ["Gold", "#c9a227"], ["Pastel Pink", "#f2b8c6"],
];

/** Deterministic PRNG so reruns produce the same catalogue. */
function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Uploads remote images in parallel (bounded), returning stored image records. */
async function uploadPool(cloudinary, sources, folder) {
  const results = new Array(sources.length);
  let next = 0;
  async function worker() {
    while (next < sources.length) {
      const index = next++;
      const { url, publicId } = sources[index];
      const result = await cloudinary.uploader.upload(url, {
        folder,
        public_id: publicId,
        overwrite: true,
        tags: [TAG],
        resource_type: "image",
      });
      results[index] = mapUploadResult(result);
      process.stdout.write(`\rImages uploaded: ${results.filter(Boolean).length}/${sources.length}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  process.stdout.write("\n");
  return results;
}

await connect();
const tenant = await Tenant.findOne({ slug: args.tenant }).lean();
if (!tenant) fail(`No store with slug "${args.tenant}".`);
const cloudinary = getCloudinary();

await runWithTenant(String(tenant._id), async () => {
  if (args.remove) {
    const products = await Product.deleteMany({ sku: /^TST-/ });
    const categories = await Category.deleteMany({ slug: /^tst-/ });
    const images = await cloudinary.api.delete_resources_by_tag(TAG);
    process.stdout.write(
      `Removed ${products.deletedCount} test products, ${categories.deletedCount} test categories and ${Object.keys(images.deleted ?? {}).length} images.\n`,
    );
    return;
  }

  if (await Product.exists({ sku: /^TST-/ })) {
    fail("Test data already exists in this store. Run with --remove first to recreate it.");
  }

  // Attribute lists, so storefront filters and the admin product form have values.
  const lists = [
    ["fabric", FABRICS.map((label) => [label])],
    ["weave", WEAVES.map((label) => [label])],
    ["occasion", OCCASIONS.map((label) => [label])],
    ["pattern", PATTERNS.map((label) => [label])],
    ["color", COLOURS],
  ];
  for (const [type, values] of lists) {
    await Attribute.bulkWrite(
      values.map(([label, hex = ""], sortOrder) => ({
        updateOne: {
          filter: { type, slug: slugify(label) },
          update: { $setOnInsert: { type, label, slug: slugify(label), hex, sortOrder, isActive: true } },
          upsert: true,
        },
      })),
    );
  }

  const categoryImages = await uploadPool(
    cloudinary,
    CATEGORIES.map((_, index) => ({ url: `https://picsum.photos/seed/norosilk-cat-${index + 1}/800/800`, publicId: `test-category-${index + 1}` })),
    storeFolder(CLOUDINARY_FOLDERS.categories),
  );
  const productImages = await uploadPool(
    cloudinary,
    Array.from({ length: PRODUCT_IMAGE_POOL }, (_, index) => ({
      url: `https://picsum.photos/seed/norosilk-product-${index + 1}/900/1125`,
      publicId: `test-product-${index + 1}`,
    })),
    storeFolder(CLOUDINARY_FOLDERS.productsSarees),
  );

  const categories = await Category.insertMany(
    CATEGORIES.map(([name, description], index) => ({
      name,
      slug: `tst-${slugify(name)}`,
      description,
      image: { url: categoryImages[index].secureUrl, alt: `${name} sarees` },
      isActive: true,
      sortOrder: 100 + index,
    })),
  );

  const random = prng(2026);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const image = (index, alt, isPrimary, sortOrder) => {
    const source = productImages[index % productImages.length];
    return { ...source, url: source.secureUrl, alt, isPrimary, sortOrder };
  };

  const products = Array.from({ length: PRODUCT_COUNT }, (_, index) => {
    const category = categories[index % categories.length];
    const weave = pick(WEAVES);
    const fabric = pick(FABRICS);
    const pattern = pick(PATTERNS);
    const occasion = pick(OCCASIONS);
    const number = String(index + 1).padStart(3, "0");
    const name = `${weave} ${fabric} Saree with ${pattern} ${number}`;
    const sku = `TST-${weave.slice(0, 3)}-${number}`.toUpperCase();
    const retail = Math.round((1500 + random() * 23500) / 50) * 50;
    const wholesale = Math.round((retail * (0.58 + random() * 0.12)) / 10) * 10;
    const moq = pick([5, 10, 12, 20, 25]);
    const colours = [...COLOURS].sort(() => random() - 0.5).slice(0, 1 + Math.floor(random() * 4));
    const imageIndex = index * 2;
    return {
      name,
      slug: `tst-${slugify(name)}`,
      sku,
      shortDescription: `${weave} weave in ${fabric.toLowerCase()} with a ${pattern.toLowerCase()}, ideal for ${occasion.toLowerCase()}.`,
      description:
        `A ${weave} saree woven in ${fabric.toLowerCase()}, finished with a ${pattern.toLowerCase()} and a contrast pallu. ` +
        `Comes with an unstitched blouse piece.\n\nEach piece is checked before dispatch; slight variations in weave and colour are a mark of handwork.`,
      category: category._id,
      images: [image(imageIndex, `${name}, front`, true, 0), image(imageIndex + 1, `${name}, pallu detail`, false, 1)],
      fabric,
      weavingType: weave,
      occasion,
      design: pattern,
      sareeLength: "5.5 m saree + 0.8 m blouse",
      blousePiece: "Included (unstitched)",
      careInstructions: fabric.includes("Silk")
        ? "Dry clean only. Store folded in muslin, away from damp. Iron on low heat on the reverse."
        : "Hand wash separately in cold water with mild detergent. Dry in shade. Iron on medium heat.",
      variants: colours.map(([colorName, colorHex], variantIndex) => ({
        colorName,
        colorHex,
        sku: `${sku}-${variantIndex + 1}`,
        stockQuantity: random() < 0.1 ? 0 : 20 + Math.floor(random() * 380),
        images: [image(imageIndex + variantIndex, `${name} in ${colorName}`, true, 0)],
        sortOrder: variantIndex,
      })),
      price: retail,
      compareAtPrice: random() < 0.35 ? Math.round((retail * 1.2) / 50) * 50 : 0,
      wholesalePrice: wholesale,
      minimumOrderQuantity: moq,
      bulkPricingTiers: [
        { minQuantity: moq * 5, pricePerUnit: Math.round(wholesale * 0.95) },
        { minQuantity: moq * 20, pricePerUnit: Math.round(wholesale * 0.9) },
      ],
      hsnCode: fabric.includes("Silk") ? "5007" : fabric === "Cotton" ? "5208" : "5407",
      gstRatePercent: 5,
      status: "active",
      featured: index < 8,
      popularityScore: Math.floor(random() * 1000),
      seoTitle: `${name} | ${category.name}`,
      seoDescription: `Buy the ${name.toLowerCase()} in ${colours.map(([colour]) => colour).join(", ")}. Wholesale MOQ ${moq} pieces.`,
    };
  });

  await Product.insertMany(products);
  process.stdout.write(`Added ${categories.length} test categories and ${products.length} test products to ${tenant.slug}.\n`);
});

await disconnect();
