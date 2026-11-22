import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { PRODUCT_STATUS, isListedProduct } from "@/lib/constants/product-status";
import { ATTRIBUTE_INPUTS } from "@/lib/constants/catalog";
import { onProductBackInStock } from "@/lib/notifications/events";
import { resolveCategoryReference } from "@/lib/services/category.service";
import { sizeOptionKeyOf, sizeOrderOf } from "@/lib/services/product-type.service";
import {
  buildProductFilter,
  buildProductSort,
  productRepository,
} from "@/lib/repositories/product.repository";
import { rememberSlug, slugify, withSlugSuffix } from "@/lib/utils/slugify";
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
import { attributeRecordOf, canonicalizeValue } from "@/lib/catalog/attribute-values";
import { combinationKey, optionsOf, sizeRangeOf, variantTitleOf } from "@/lib/catalog/variants";

import { Product } from "@/lib/db/models/Product";
import { ProductType } from "@/lib/db/models/ProductType";
import { ProductAttribute } from "@/lib/db/models/ProductAttribute";

const parse = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  return parsed.data;
};

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
 * The product type and the library attributes it uses.
 * @param {unknown} typeId
 */
async function loadTypeContext(typeId) {
  const type = mongoose.isValidObjectId(typeId) ? await ProductType.findById(typeId).lean() : null;
  if (!type) throw new ApiError(422, "Choose what this product is (its product type).", [{ field: "productType", message: "Choose a product type." }]);
  const keys = [...type.fields.map((field) => field.key), ...type.options.map((option) => option.key)];
  const attributes = await ProductAttribute.find({ key: { $in: keys } }).lean();
  return { type, attributes: new Map(attributes.map((attribute) => [attribute.key, attribute])) };
}

/**
 * Product details as stored entries, in the type's order: canonical values,
 * keys the type doesn't use dropped, and required details enforced for
 * products being listed (drafts may be saved incomplete).
 * @param {Record<string, string | string[]>} record
 * @param {Awaited<ReturnType<typeof loadTypeContext>>} context
 * @param {boolean} listing
 * @param {{ field: string, message: string }[]} errors
 */
function buildAttributes(record, context, listing, errors) {
  const entries = [];
  for (const field of context.type.fields) {
    const attribute = context.attributes.get(field.key);
    if (!attribute) continue;
    const raw = record?.[field.key];
    const list = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
    const multi = attribute.input === ATTRIBUTE_INPUTS.MULTISELECT;
    const values = [];
    for (const item of multi ? list : list.slice(0, 1)) {
      const result = canonicalizeValue(attribute, item);
      if ("error" in result) errors.push({ field: `attributes.${field.key}`, message: result.error });
      else if (result.value && !values.includes(result.value)) values.push(result.value);
    }
    if (!values.length && field.required && listing) {
      errors.push({ field: `attributes.${field.key}`, message: `Add ${attribute.name.toLowerCase()} before listing this product.` });
    }
    for (const value of values) entries.push({ key: field.key, value });
  }
  return entries;
}

/**
 * Variants validated against the type's options: every option chosen, each
 * value one the type offers, and each combination at most once.
 * @param {Record<string, any>[]} inputs
 * @param {Awaited<ReturnType<typeof loadTypeContext>>} context
 * @param {{ field: string, message: string }[]} errors
 */
function buildVariants(inputs, context, errors) {
  const { type } = context;
  const definitions = type.options
    .map((option) => ({ ...option, attribute: context.attributes.get(option.key) }))
    .filter((definition) => definition.attribute);
  if (!definitions.length && inputs.length) {
    errors.push({ field: "variants", message: `${type.pluralName} have no options (such as colour or size), so they have no variants.` });
    return [];
  }
  const colourKey = definitions.find((definition) => definition.attribute.input === ATTRIBUTE_INPUTS.COLOR)?.key ?? null;
  const seen = new Map();

  return inputs.map((input, index) => {
    /** @type {Record<string, string>} */
    const options = {};
    for (const definition of definitions) {
      const field = `variants.${index}.options.${definition.key}`;
      const result = canonicalizeValue(definition.attribute, input.options?.[definition.key]);
      if ("error" in result) {
        errors.push({ field, message: result.error });
      } else if (!result.value) {
        errors.push({ field, message: `Choose a ${definition.attribute.name.toLowerCase()} for every variant.` });
      } else if (definition.values.length && !definition.values.includes(result.value)) {
        errors.push({ field, message: `${type.pluralName} aren't offered in ${result.value}. Add it to the type's ${definition.attribute.name} values first.` });
      } else {
        options[definition.key] = result.value;
      }
    }
    const signature = combinationKey(options);
    if (Object.keys(options).length === definitions.length) {
      if (seen.has(signature)) errors.push({ field: `variants.${index}.options`, message: `${variantTitleOf(options)} is listed twice.` });
      seen.set(signature, index);
    }
    const colorName = colourKey ? options[colourKey] ?? "" : "";
    const libraryHex = colourKey ? context.attributes.get(colourKey)?.values.find((value) => value.label === colorName)?.hex : "";
    return {
      ...(input._id ? { _id: input._id } : {}),
      options,
      title: variantTitleOf(options),
      colorName,
      colorHex: input.colorHex || libraryHex || "#999999",
      sku: input.sku.toUpperCase(),
      barcode: input.barcode ?? "",
      stockQuantity: input.stockQuantity,
      ...(input.stockBaseline !== undefined ? { stockBaseline: input.stockBaseline } : {}),
      sortOrder: index,
    };
  });
}

/** Photos for the colours the product has, each colour once. */
function buildColorMedia(media, variants) {
  const colours = new Set(variants.map((variant) => variant.colorName).filter(Boolean));
  const seen = new Set();
  return (media ?? [])
    .filter((entry) => colours.has(entry.color) && !seen.has(entry.color) && seen.add(entry.color))
    .map((entry) => ({
      color: entry.color,
      images: entry.images.map((image, index) => ({ ...image, sortOrder: image.sortOrder ?? index, isPrimary: image.isPrimary ?? index === 0 })),
    }));
}

/** "S–XXL" for cards, from the variants' sizes in the type's order. */
function sizeRangeFor(variants, context, chart) {
  const key = chart?.optionKey || sizeOptionKeyOf(context.type, context.attributes);
  if (!key) return "";
  return sizeRangeOf(
    variants.map((variant) => optionsOf(variant)[key]),
    sizeOrderOf(context.type, context.attributes, key),
  );
}

/**
 * Refuses SKUs another product already uses (as its own or a variant's), so
 * every SKU names one sellable item across the store.
 * @param {string[]} skus
 * @param {unknown} [excludeId]
 */
async function assertSkusAvailable(skus, excludeId = null) {
  const wanted = [...new Set(skus.map((sku) => sku.toUpperCase()))];
  if (!wanted.length) return;
  const clash = await Product.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [{ sku: { $in: wanted } }, { "variants.sku": { $in: wanted } }],
  })
    .select("name sku variants.sku")
    .lean();
  if (!clash) return;
  const taken = [clash.sku, ...(clash.variants ?? []).map((variant) => variant.sku)].find((sku) => wanted.includes(sku));
  throw new ApiError(409, `SKU ${taken} is already used by “${clash.name}”.`, [{ field: "sku", message: `SKU ${taken} is taken.` }]);
}

/** Variant fields as stored: the stock baseline is an edit check, not data. */
const storedVariant = ({ stockBaseline: _baseline, ...variant }) => variant;

/**
 * @param {unknown} payload
 * @param {Record<string, any> | null} [actor] the admin creating it, for the stock ledger
 */
export async function createProduct(payload, actor = null) {
  const data = parse(createProductInputSchema, payload);
  const context = await loadTypeContext(data.productType);
  const status = data.status ?? PRODUCT_STATUS.DRAFT;
  const errors = [];
  const attributes = buildAttributes(data.attributes ?? {}, context, status === PRODUCT_STATUS.ACTIVE, errors);
  const variants = buildVariants(data.variants ?? [], context, errors);
  if (errors.length) throw new ApiError(422, errors[0].message, errors);

  const [categoryId, slug] = await Promise.all([
    resolveCategoryReference(data.category),
    ensureUniqueProductSlug(data.slug || data.name),
    assertSkusAvailable([data.sku, ...variants.map((variant) => variant.sku)]),
  ]);

  let product;
  try {
    const {
      category: _category,
      slug: _slug,
      stockBaseline: _baseline,
      variants: _variants,
      attributes: _attributes,
      colorMedia,
      sizeChart,
      productType: _type,
      ...rest
    } = data;
    product = await productRepository.create({
      ...rest,
      productType: context.type._id,
      typeHidden: !context.type.isActive,
      attributes,
      variants: variants.map(storedVariant),
      colorMedia: buildColorMedia(colorMedia, variants),
      sizeChart: sizeChart ?? null,
      sizeRange: sizeRangeFor(variants, context, sizeChart),
      category: categoryId,
      slug,
      sku: data.sku.toUpperCase(),
      status,
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

/** Product fields an edit assigns as sent (type, details, variants, category, slug and stock have their own rules). */
const ASSIGNABLE_FIELDS = [
  "name",
  "sku",
  "description",
  "shortDescription",
  "images",
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
 *
 * Details and variants are checked against the product type (the new one when
 * the edit changes it). A partial edit that leaves them out keeps them. A
 * product being listed (or whose details change while listed) must have its
 * type's required details.
 * @param {string} productId
 * @param {unknown} payload
 * @param {Record<string, any> | null} [actor] the admin making the change
 */
export async function updateProduct(productId, payload, actor = null) {
  const data = parse(updateProductSchema, payload);
  const current = await getProduct(productId);
  const typeChanged = data.productType !== undefined && String(data.productType) !== String(current.productType ?? "");
  const touchesShape = typeChanged || data.attributes !== undefined || data.variants !== undefined || data.colorMedia !== undefined || data.sizeChart !== undefined;
  const status = data.status ?? current.status;
  const listing = status === PRODUCT_STATUS.ACTIVE;
  // Required details are checked when a product goes on the storefront, or when its details change;
  // a quick price, stock or slug fix to a listed product is never blocked by an unrelated detail.
  const publishing = listing && current.status !== PRODUCT_STATUS.ACTIVE;

  /** @type {Record<string, any>} */
  const shape = {};
  if (touchesShape || (publishing && current.productType)) {
    const context = await loadTypeContext(data.productType ?? current.productType);
    const errors = [];
    const multi = (key) => context.attributes.get(key)?.input === ATTRIBUTE_INPUTS.MULTISELECT;
    const record = data.attributes ?? attributeRecordOf(current.attributes, multi);
    shape.attributes = buildAttributes(record, context, listing, errors);
    const variantInputs =
      data.variants ??
      current.variants.map((variant) => ({ _id: String(variant._id), options: optionsOf(variant), colorHex: variant.colorHex, sku: variant.sku, barcode: variant.barcode, stockQuantity: variant.stockQuantity }));
    const variants = buildVariants(variantInputs, context, errors);
    if (errors.length) throw new ApiError(422, errors[0].message, errors);

    const chart = data.sizeChart !== undefined ? data.sizeChart : current.sizeChart?.toObject?.() ?? current.sizeChart ?? null;
    if (chart?.optionKey && !context.type.options.some((option) => option.key === chart.optionKey)) {
      throw new ApiError(422, "The size chart must describe one of the product's options.", [{ field: "sizeChart.optionKey", message: "Pick one of the options." }]);
    }
    const media = data.colorMedia ?? current.colorMedia.map((entry) => entry.toObject());
    Object.assign(shape, {
      productType: context.type._id,
      typeHidden: !context.type.isActive,
      variants: data.variants !== undefined || typeChanged ? variants : undefined,
      colorMedia: buildColorMedia(media, variants),
      sizeChart: chart,
      sizeRange: sizeRangeFor(variants, context, chart),
    });
    if (shape.variants) await assertSkusAvailable([data.sku ?? current.sku, ...variants.map((variant) => variant.sku)], current._id);
  }
  if (data.sku && !shape.variants) await assertSkusAvailable([data.sku], current._id);

  const [categoryId, slug] = await Promise.all([
    data.category ? resolveCategoryReference(data.category) : null,
    // Slugs stay stable on rename (links and search rankings depend on them); change only when asked.
    data.slug ? ensureUniqueProductSlug(data.slug, current._id) : null,
  ]);

  const { product, before } = await withTransaction(async (session) => {
    const product = await Product.findById(current._id).session(session);
    if (!product) throw new ApiError(404, "Product not found.");
    const before = orderableState(product);

    if (categoryId) product.category = categoryId;
    if (slug && slug !== product.slug) {
      product.previousSlugs = rememberSlug(product.previousSlugs, product.slug, slug);
      product.slug = slug;
    }
    for (const field of ASSIGNABLE_FIELDS) {
      if (data[field] !== undefined) product[field] = field === "sku" ? data[field].toUpperCase() : data[field];
    }
    if (shape.productType) {
      product.productType = shape.productType;
      product.typeHidden = shape.typeHidden;
      product.attributes = shape.attributes;
      product.sizeChart = shape.sizeChart;
    }
    const stockChanges = applyStockEdits(product, { ...data, variants: shape.variants });
    if (shape.productType) {
      product.colorMedia = shape.colorMedia;
      product.sizeRange = shape.sizeRange;
    }

    await product.save({ session });
    await recordAdminStockChanges(stockChanges, { session, actor: actor?._id ?? null });
    return { product, before };
  });

  notifyRestocks(before, product);
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
 * @param {Record<string, any>} data the validated edit, with variants already checked against the type
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
      if (!current) {
        const { _id: _unknown, ...fresh } = input;
        return fresh;
      }
      kept.add(String(current._id));
      const stockQuantity = resolve(current.stockQuantity, input.stockQuantity, stockBaseline, `variants.${index}.stockQuantity`);
      if (stockQuantity !== current.stockQuantity) changes.push({ variantId: current._id, delta: stockQuantity - current.stockQuantity });
      return { ...input, _id: current._id, stockQuantity };
    });
    product.markModified("variants");
    for (const variant of product.variants) {
      if (!existing.has(String(variant._id)) && variant.stockQuantity) changes.push({ variantId: variant._id, delta: variant.stockQuantity });
    }
    // A removed variant takes its stock with it; a product gaining variants replaces its single stock figure.
    for (const [id, variant] of existing) {
      if (!kept.has(id) && variant.stockQuantity) changes.push({ variantId: variant._id, delta: -variant.stockQuantity });
    }
    if (!hadVariants && product.variants.length && previousTotal) changes.push({ variantId: null, delta: -previousTotal });
  }

  // With variants, the product total is derived from them (Product pre-validate hook).
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

/**
 * What shoppers could order: the product as a whole (listed, enough stock for
 * the minimum order) and each variant on its own, so a restocked size can
 * alert the shoppers waiting for that size.
 * @param {Record<string, any>} product
 */
function orderableState(product) {
  const listed = isListedProduct(product);
  const minimum = product.minimumOrderQuantity ?? 1;
  return {
    product: listed && product.stockQuantity >= minimum,
    variants: new Set(listed ? product.variants.filter((variant) => variant.stockQuantity >= minimum).map((variant) => String(variant._id)) : []),
  };
}

/** Back-in-stock alerts for the product and for each variant that became orderable. */
function notifyRestocks(before, product) {
  const after = orderableState(product);
  const variantIds = [...after.variants].filter((id) => !before.variants.has(id));
  const productRestocked = !before.product && after.product;
  if (productRestocked || variantIds.length) onProductBackInStock(product, { productRestocked, variantIds });
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
