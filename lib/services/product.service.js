import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { onProductBackInStock } from "@/lib/notifications/events";
import { resolveCategoryReference } from "@/lib/services/category.service";
import {
  buildProductFilter,
  buildProductSort,
  productRepository,
} from "@/lib/repositories/product.repository";
import { slugify, withSlugSuffix } from "@/lib/utils/slugify";
import { canonicalizeProductAttributes } from "@/lib/services/attribute.service";
import {
  createProductInputSchema,
  updateProductSchema,
  productImagesSchema,
  productQuerySchema,
} from "@/lib/validators/product.validator";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";

import { Product } from "@/lib/db/models/Product";

async function ensureUniqueProductSlug(name, excludeId) {
  let attempt = 1;
  const base = slugify(name);
  while (attempt < 50) {
    const candidate = withSlugSuffix(base, attempt);
    const filter = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    const existing = await Product.findOne(filter).select("_id");
    if (!existing) return candidate;
    attempt += 1;
  }
  throw new ApiError(409, "Could not generate a unique product slug.");
}

export async function listProducts(searchParams) {
  const parsed = productQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const { page, limit, skip } = parsePagination(searchParams);
  const filter = buildProductFilter(parsed.data);
  const sort = buildProductSort(parsed.data);
  const { items, total } = await productRepository.list({ filter, sort, skip, limit });
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

export async function getProduct(productId) {
  const product = await productRepository.findByIdOrSlug(productId);
  if (!product) throw new ApiError(404, "Product not found.");
  return product;
}

export async function createProduct(payload) {
  const parsed = createProductInputSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }
  await canonicalizeProductAttributes(parsed.data);

  const categoryId = await resolveCategoryReference(parsed.data.category);
  const slug = await ensureUniqueProductSlug(parsed.data.slug || parsed.data.name);

  try {
    const { category: _category, slug: _slug, ...rest } = parsed.data;
    return await productRepository.create({
      ...rest,
      category: categoryId,
      slug,
      sku: parsed.data.sku.toUpperCase(),
      status: parsed.data.status ?? PRODUCT_STATUS.DRAFT,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      throw new ApiError(409, "Product with this SKU or slug already exists.");
    }
    throw error;
  }
}

export async function updateProduct(productId, payload) {
  const parsed = updateProductSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  await canonicalizeProductAttributes(parsed.data);
  const product = await getProduct(productId);
  const wasOrderable = isOrderable(product);
  if (parsed.data.category) {
    product.category = await resolveCategoryReference(parsed.data.category);
  }
  if (parsed.data.name) product.name = parsed.data.name;
  // Slugs stay stable on rename (links and search rankings depend on them); change only when asked.
  if (parsed.data.slug && parsed.data.slug !== product.slug) {
    product.slug = await ensureUniqueProductSlug(parsed.data.slug, product._id);
  }

  const assignableFields = [
    "sku",
    "description",
    "shortDescription",
    "category",
    "images",
    "fabric",
    "weavingType",
    "sareeLength",
    "blousePiece",
    "colors",
    "design",
    "occasion",
    "careInstructions",
    "variants",
    "hsnCode",
    "gstRatePercent",
    "price",
    "compareAtPrice",
    "wholesalePrice",
    "bulkPricingTiers",
    "minimumOrderQuantity",
    "stockQuantity",
    "status",
    "featured",
    "seoTitle",
    "seoDescription",
  ];

  for (const field of assignableFields) {
    if (parsed.data[field] !== undefined) {
      product[field] = field === "sku" ? parsed.data[field].toUpperCase() : parsed.data[field];
      if (field === "variants") product.markModified("variants");
    }
  }

  await productRepository.save(product);
  if (!wasOrderable && isOrderable(product)) onProductBackInStock(product);
  return product;
}

/** Matches the storefront: listed (active) and enough stock for the minimum order. */
function isOrderable(product) {
  return product.status === PRODUCT_STATUS.ACTIVE && product.stockQuantity >= product.minimumOrderQuantity;
}

export async function deleteProduct(productId) {
  const product = await getProduct(productId);
  product.status = PRODUCT_STATUS.INACTIVE;
  await productRepository.save(product);
  return product;
}

export async function replaceProductImages(productId, payload) {
  const parsed = productImagesSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }
  const product = await getProduct(productId);
  product.images = parsed.data.images.map((image, index) => ({
    ...image,
    sortOrder: image.sortOrder ?? index,
    isPrimary: image.isPrimary ?? index === 0,
  }));
  await productRepository.save(product);
  return product;
}
