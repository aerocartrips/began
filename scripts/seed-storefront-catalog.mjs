import mongoose from "mongoose";
import { catalogSeedProducts } from "./catalog-seed-data.mjs";

const MONGODB_URI = process.env.MONGODB_URI?.trim();
if (!MONGODB_URI) {
  process.stderr.write("Set MONGODB_URI before running the catalog seed.\n");
  process.exit(1);
}

const categorySchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    description: String,
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    sku: String,
    description: String,
    shortDescription: String,
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    images: Array,
    fabric: String,
    weavingType: String,
    sareeLength: String,
    blousePiece: String,
    colors: [String],
    design: String,
    occasion: String,
    price: Number,
    compareAtPrice: Number,
    wholesalePrice: Number,
    minimumOrderQuantity: Number,
    stockQuantity: Number,
    status: { type: String, default: "active" },
    featured: Boolean,
    seoTitle: String,
    seoDescription: String,
  },
  { timestamps: true },
);

const Category = mongoose.models.SeedCategory || mongoose.model("SeedCategory", categorySchema, "categories");
const Product = mongoose.models.SeedProduct || mongoose.model("SeedProduct", productSchema, "products");

function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

await mongoose.connect(MONGODB_URI);

for (const seedProduct of catalogSeedProducts) {
  const categorySlug = slugify(seedProduct.category);
  let category = await Category.findOne({ slug: categorySlug });
  if (!category) {
    category = await Category.create({
      name: seedProduct.category,
      slug: categorySlug,
      description: `${seedProduct.category} wholesale sarees`,
      isActive: true,
      sortOrder: 0,
    });
  }

  await Product.findOneAndUpdate(
    { sku: seedProduct.sku },
    {
      ...seedProduct,
      slug: seedProduct.slug,
      category: category._id,
      status: "active",
      seoTitle: `${seedProduct.name} | Norosilk`,
      seoDescription: seedProduct.description,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  process.stdout.write(`Seeded ${seedProduct.sku}\n`);
}

await mongoose.disconnect();
process.stdout.write("Catalog seed complete.\n");
