/**
 * Seeds a store with attribute lists, categories and realistic saree products
 * (colour variants, quantity tiers, MOQs). Re-running adds nothing that exists.
 *
 *   npm run seed:catalog -- --tenant acme              # 60 products
 *   npm run seed:catalog -- --tenant acme --count 20000  # load-test a large catalogue
 *
 * Products are generated deterministically, so runs are reproducible.
 */
import { connect, disconnect, fail, parseCli } from "./lib/cli.mjs";
import { Tenant } from "@/lib/db/models/Tenant";
import { Attribute } from "@/lib/db/models/Attribute";
import { Category } from "@/lib/db/models/Category";
import { Product } from "@/lib/db/models/Product";
import { runWithTenant } from "@/lib/tenant/context";
import { slugify } from "@/lib/utils/slugify";

const args = parseCli(
  { tenant: { type: "string" }, count: { type: "string", default: "60" } },
  "Usage: npm run seed:catalog -- --tenant <slug> [--count <products>]",
);
if (!args.tenant) fail("--tenant is required.");
const count = Math.min(Math.max(Number.parseInt(args.count, 10) || 60, 1), 100000);

const FABRICS = ["Pure Silk", "Silk Cotton", "Cotton", "Linen", "Organza", "Georgette", "Chiffon", "Tussar Silk"];
const WEAVES = ["Banarasi", "Kanchipuram", "Chanderi", "Paithani", "Jamdani", "Ikat", "Bandhani", "Handloom"];
const OCCASIONS = ["Wedding", "Festive", "Party", "Office", "Daily wear"];
const PATTERNS = ["Zari border", "Buta", "Floral", "Checks", "Temple border", "Plain body"];
const COLOURS = [
  ["Ruby Red", "#9b111e"], ["Emerald Green", "#046307"], ["Royal Blue", "#1d3f91"], ["Mustard", "#d4a017"],
  ["Ivory", "#f3eadb"], ["Black", "#1b1b1b"], ["Magenta", "#b0126f"], ["Peach", "#f4a582"],
  ["Teal", "#08757a"], ["Wine", "#5e1224"], ["Gold", "#c9a227"], ["Pastel Pink", "#f2b8c6"],
];
const CATEGORIES = [
  ["Banarasi Sarees", "Rich silk and zari weaves from Varanasi."],
  ["Kanchipuram Silk", "Temple-border silks from Tamil Nadu."],
  ["Cotton Handloom", "Breathable everyday handloom cottons."],
  ["Chanderi & Organza", "Light, sheer weaves for festive wear."],
  ["Linen Sarees", "Easy-care linen for work and travel."],
  ["Designer Party Wear", "Statement sarees for celebrations."],
];

/** Small deterministic PRNG so seeds are reproducible. */
function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

await connect();
const tenant = await Tenant.findOne({ slug: args.tenant }).lean();
if (!tenant) fail(`No store with slug "${args.tenant}".`);

await runWithTenant(String(tenant._id), async () => {
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

  const categoryIds = [];
  for (const [index, [name, description]] of CATEGORIES.entries()) {
    const category = await Category.findOneAndUpdate(
      { slug: slugify(name) },
      { $setOnInsert: { name, slug: slugify(name), description, isActive: true, sortOrder: index } },
      { upsert: true, returnDocument: "after" },
    );
    categoryIds.push(category._id);
  }

  const existing = await Product.countDocuments({});
  const random = prng(existing + 7);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const batchSize = 1000;
  let created = 0;

  for (let start = existing; start < existing + count; start += batchSize) {
    const batch = [];
    for (let index = start; index < Math.min(start + batchSize, existing + count); index += 1) {
      const weave = pick(WEAVES);
      const fabric = pick(FABRICS);
      const pattern = pick(PATTERNS);
      const number = String(index + 1).padStart(5, "0");
      const name = `${weave} ${fabric} Saree ${pattern} ${number}`;
      const sku = `${weave.slice(0, 3)}-${fabric.replace(/\s/g, "").slice(0, 3)}-${number}`.toUpperCase();
      const retail = Math.round((1200 + random() * 23800) / 50) * 50;
      const wholesale = Math.round((retail * (0.58 + random() * 0.12)) / 10) * 10;
      const moq = pick([5, 10, 12, 20, 25, 50]);
      const colours = [...COLOURS].sort(() => random() - 0.5).slice(0, 1 + Math.floor(random() * 4));
      batch.push({
        name,
        slug: `${slugify(name)}`,
        sku,
        shortDescription: `${weave} weave in ${fabric.toLowerCase()} with ${pattern.toLowerCase()}.`,
        description: `A ${weave} saree in ${fabric.toLowerCase()}, finished with a ${pattern.toLowerCase()}. Comes with an unstitched blouse piece.\n\nEach piece is checked before dispatch; slight variations are a mark of handwork.`,
        category: categoryIds[index % categoryIds.length],
        fabric,
        weavingType: weave,
        occasion: pick(OCCASIONS),
        design: pattern,
        sareeLength: "5.5 m + 0.8 m blouse",
        blousePiece: "Included",
        careInstructions: fabric.includes("Silk") ? "Dry clean only. Store in muslin." : "Gentle hand wash in cold water. Dry in shade.",
        variants: colours.map(([colorName, colorHex], variantIndex) => ({
          colorName,
          colorHex,
          sku: `${sku}-${variantIndex + 1}`,
          stockQuantity: random() < 0.08 ? 0 : Math.floor(random() * 400),
          sortOrder: variantIndex,
        })),
        price: retail,
        compareAtPrice: random() < 0.3 ? Math.round(retail * 1.2) : 0,
        wholesalePrice: wholesale,
        minimumOrderQuantity: moq,
        bulkPricingTiers: [
          { minQuantity: moq * 5, pricePerUnit: Math.round(wholesale * 0.95) },
          { minQuantity: moq * 20, pricePerUnit: Math.round(wholesale * 0.9) },
        ],
        hsnCode: fabric.includes("Silk") ? "5007" : fabric === "Cotton" ? "5208" : "5407",
        status: "active",
        featured: index < existing + 8,
        popularityScore: Math.floor(random() * 1000),
      });
    }
    await Product.insertMany(batch, { ordered: false });
    created += batch.length;
    process.stdout.write(`\rProducts created: ${created}/${count}`);
  }
  process.stdout.write(`\nSeeded ${tenant.slug}: ${lists.reduce((sum, [, values]) => sum + values.length, 0)} attribute values, ${CATEGORIES.length} categories, ${created} products.\n`);
});

await disconnect();
