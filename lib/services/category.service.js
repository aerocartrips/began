import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { Category } from "@/lib/db/models/Category";
import { slugify, withSlugSuffix } from "@/lib/utils/slugify";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validators/category.validator";
import { formatZodErrors } from "@/lib/validators/auth.validator";

async function ensureUniqueSlug(baseName, excludeId) {
  let attempt = 1;
  let slug = slugify(baseName);
  while (attempt < 50) {
    const candidate = withSlugSuffix(slug, attempt);
    const filter = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    const existing = await Category.findOne(filter).select("_id");
    if (!existing) return candidate;
    attempt += 1;
  }
  throw new ApiError(409, "Could not generate a unique category slug.");
}

export async function listCategories({ includeInactive = false } = {}) {
  const filter = includeInactive ? {} : { isActive: true };
  return Category.find(filter).sort({ sortOrder: 1, name: 1 }).populate("parentCategory", "name slug");
}

export async function getCategoryById(categoryId) {
  if (!mongoose.isValidObjectId(categoryId)) {
    throw new ApiError(404, "Category not found.");
  }
  const category = await Category.findById(categoryId).populate("parentCategory", "name slug");
  if (!category) throw new ApiError(404, "Category not found.");
  return category;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve category ObjectId from Mongo id or category name (creates category if missing). */
export async function resolveCategoryReference(categoryInput) {
  const value = String(categoryInput ?? "").trim();
  if (!value) {
    throw new ApiError(422, "Validation failed.", [
      { field: "category", message: "Category is required." },
    ]);
  }

  if (mongoose.isValidObjectId(value)) {
    const existing = await Category.findById(value).select("_id");
    if (!existing) {
      throw new ApiError(422, "Validation failed.", [
        { field: "category", message: "Category does not exist." },
      ]);
    }
    return existing._id;
  }

  const byName = await Category.findOne({
    name: new RegExp(`^${escapeRegex(value)}$`, "i"),
  }).select("_id");

  if (byName) return byName._id;

  const created = await createCategory({ name: value });
  return created._id;
}

export async function createCategory(payload) {
  const parsed = createCategorySchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  if (parsed.data.parentCategory && !mongoose.isValidObjectId(parsed.data.parentCategory)) {
    throw new ApiError(422, "Validation failed.", [
      { field: "parentCategory", message: "Invalid parent category." },
    ]);
  }

  const slug = await ensureUniqueSlug(parsed.data.name);
  return Category.create({
    ...parsed.data,
    slug,
    parentCategory: parsed.data.parentCategory ?? null,
  });
}

export async function updateCategory(categoryId, payload) {
  const parsed = updateCategorySchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const category = await getCategoryById(categoryId);
  if (parsed.data.name) {
    category.slug = await ensureUniqueSlug(parsed.data.name, category._id);
    category.name = parsed.data.name;
  }

  if (parsed.data.description !== undefined) category.description = parsed.data.description;
  if (parsed.data.image !== undefined) category.image = parsed.data.image;
  if (parsed.data.parentCategory !== undefined) {
    if (parsed.data.parentCategory && String(parsed.data.parentCategory) === String(category._id)) {
      throw new ApiError(422, "Validation failed.", [
        { field: "parentCategory", message: "Category cannot be its own parent." },
      ]);
    }
    category.parentCategory = parsed.data.parentCategory;
  }
  if (parsed.data.isActive !== undefined) category.isActive = parsed.data.isActive;
  if (parsed.data.sortOrder !== undefined) category.sortOrder = parsed.data.sortOrder;

  await category.save();
  return category;
}

export async function deleteCategory(categoryId) {
  const category = await getCategoryById(categoryId);
  category.isActive = false;
  await category.save();
  return category;
}
