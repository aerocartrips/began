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
import { withTransaction } from "@/lib/db/transaction";
import { recordAdminStockChanges } from "@/lib/services/inventory.service";

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

/**
 * @param {unknown} payload
 * @param {Record<string, any> | null} [actor] the admin creating it, for the stock ledger
 */
export async function createProduct(payload, actor = null) {
  const parsed = createProductInputSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }
  await canonicalizeProductAttributes(parsed.data);

  const categoryId = await resolveCategoryReference(parsed.data.category);
  const slug = await ensureUniqueProductSlug(parsed.data.slug || parsed.data.name);

  let product;
  try {
    const { category: _category, slug: _slug, stockBaseline: _baseline, variants, ...rest } = parsed.data;
    product = await productRepository.create({
      ...rest,
      ...(variants ? { variants: variants.map(({ stockBaseline: _variantBaseline, ...variant }) => variant) } : {}),
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

  // Opening stock, so the ledger accounts for every unit from the start.
  const opening = product.variants.length
    ? product.variants.map((variant) => ({ productId: product._id, variantId: variant._id, delta: variant.stockQuantity }))
    : [{ productId: product._id, variantId: null, delta: product.stockQuantity }];
  await recordAdminStockChanges(opening, { actor: actor?._id ?? null });
  return product;
}

/** Product fields an edit assigns as sent (category, slug, variants and stock have their own rules). */
const ASSIGNABLE_FIELDS = [
  "name",
  "sku",
  "description",
  "shortDescription",
  "images",
  "fabric",
  "weavingType",
  "sareeLength",
  "blousePiece",
  "colors",
  "design",
  "occasion",
  "careInstructions",
  "hsnCode",
  "gstRatePercent",
  "price",
  "compareAtPrice",
  "wholesalePrice",
  "bulkPricingTiers",
  "minimumOrderQuantity",
  "status",
  "featured",
  "seoTitle",
  "seoDescription",
];

/**
 * Applies an edit in a transaction, so a concurrent order can't interleave
 * with it, and without losing sales made while the editor was open: stock
 * values are compared with the `stockBaseline` the editor loaded (see
 * applyStockEdits). Every stock change is written to the stock ledger.
 * @param {string} productId
 * @param {unknown} payload
 * @param {Record<string, any> | null} [actor] the admin making the change
 */
export async function updateProduct(productId, payload, actor = null) {
  const parsed = updateProductSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }
  const data = parsed.data;
  await canonicalizeProductAttributes(data);
  const { _id } = await getProduct(productId);
  const [categoryId, slug] = await Promise.all([
    data.category ? resolveCategoryReference(data.category) : null,
    // Slugs stay stable on rename (links and search rankings depend on them); change only when asked.
    data.slug ? ensureUniqueProductSlug(data.slug, _id) : null,
  ]);

  const { product, wasOrderable } = await withTransaction(async (session) => {
    const product = await Product.findById(_id).session(session);
    if (!product) throw new ApiError(404, "Product not found.");
    const wasOrderable = isOrderable(product);

    if (categoryId) product.category = categoryId;
    if (slug) product.slug = slug;
    for (const field of ASSIGNABLE_FIELDS) {
      if (data[field] !== undefined) product[field] = field === "sku" ? data[field].toUpperCase() : data[field];
    }
    const stockChanges = applyStockEdits(product, data);

    await product.save({ session });
    await recordAdminStockChanges(stockChanges, { session, actor: actor?._id ?? null });
    return { product, wasOrderable };
  });

  if (!wasOrderable && isOrderable(product)) onProductBackInStock(product);
  return product;
}

/**
 * Stock edits that keep sales made while the editor was open. A value equal to
 * its `stockBaseline` (what the editor loaded) was not touched, so the current
 * stock stands. A changed value replaces the stock only if the stock still
 * equals that baseline; otherwise the save is refused with a 409 naming the
 * field, so the admin can review the new figure. Without a baseline (API
 * clients) the value is set as sent.
 * @param {import("mongoose").Document & Record<string, any>} product loaded in the edit's transaction
 * @param {Record<string, any>} data the validated edit
 * @returns {{ productId: unknown, variantId: unknown, delta: number }[]} changes for the stock ledger
 */
function applyStockEdits(product, data) {
  const changes = [];
  const conflicts = [];
  const resolve = (current, submitted, baseline, field) => {
    if (submitted === undefined || baseline === undefined) return submitted ?? current;
    if (submitted === baseline) return current;
    if (current !== baseline) {
      conflicts.push({ field, message: `Stock changed to ${current} while you were editing. Check it and save again.` });
      return current;
    }
    return submitted;
  };

  if (data.variants !== undefined) {
    const hadVariants = product.variants.length > 0;
    const previousTotal = product.stockQuantity;
    const existing = new Map(product.variants.map((variant) => [String(variant._id), variant]));
    const kept = new Set();
    product.variants = data.variants.map(({ stockBaseline, ...input }, index) => {
      const current = input._id ? existing.get(String(input._id)) : undefined;
      if (!current) return input;
      kept.add(String(current._id));
      const stockQuantity = resolve(current.stockQuantity, input.stockQuantity, stockBaseline, `variants.${index}.stockQuantity`);
      if (stockQuantity !== current.stockQuantity) changes.push({ variantId: current._id, delta: stockQuantity - current.stockQuantity });
      return { ...input, _id: current._id, stockQuantity };
    });
    product.markModified("variants");
    for (const variant of product.variants) {
      if (!existing.has(String(variant._id)) && variant.stockQuantity) changes.push({ variantId: variant._id, delta: variant.stockQuantity });
    }
    // A removed colour takes its stock with it; a product gaining colours replaces its single stock figure.
    for (const [id, variant] of existing) {
      if (!kept.has(id) && variant.stockQuantity) changes.push({ variantId: variant._id, delta: -variant.stockQuantity });
    }
    if (!hadVariants && product.variants.length && previousTotal) changes.push({ variantId: null, delta: -previousTotal });
  }

  // With colours, the product total is derived from them (Product pre-validate hook).
  if (data.stockQuantity !== undefined && product.variants.length === 0) {
    const stockQuantity = resolve(product.stockQuantity, data.stockQuantity, data.stockBaseline, "stockQuantity");
    if (stockQuantity !== product.stockQuantity) changes.push({ variantId: null, delta: stockQuantity - product.stockQuantity });
    product.stockQuantity = stockQuantity;
  }

  if (conflicts.length) {
    throw new ApiError(409, "Stock changed while you were editing (orders came in). Check the highlighted stock and save again.", conflicts);
  }
  return changes.map((change) => ({ ...change, productId: product._id }));
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
