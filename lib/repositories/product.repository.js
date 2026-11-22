import mongoose from "mongoose";
import { Product } from "@/lib/db/models/Product";
import { listedProductFilter } from "@/lib/constants/product-status";
import { sanitizeMongoFilter } from "@/lib/utils/sanitize";
import { escapeRegex } from "@/lib/utils/escape-regex";

/**
 * @param {Record<string, unknown>} query
 */
export function buildProductFilter(query) {
  /** @type {Record<string, unknown>} */
  const filter = {};

  if (query.category && mongoose.isValidObjectId(query.category)) {
    filter.category = query.category;
  }

  if (query.type === "none") filter.productType = null;
  else if (query.type && mongoose.isValidObjectId(query.type)) filter.productType = query.type;

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.wholesalePrice = {};
    if (query.minPrice !== undefined) filter.wholesalePrice.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.wholesalePrice.$lte = query.maxPrice;
  }

  if (query.availability === "in_stock") {
    filter.stockQuantity = { $gt: 0 };
  } else if (query.availability === "out_of_stock") {
    filter.stockQuantity = { $lte: 0 };
  }

  if (query.status) {
    filter.status = query.status;
  } else if (!query.availability && !query.admin) {
    // Public reads only ever see what the storefront lists.
    Object.assign(filter, listedProductFilter());
  }

  const safe = sanitizeMongoFilter(filter);
  // Added after sanitising, which drops dotted paths: these are server-built and the term is escaped.
  if (query.search) {
    const regex = new RegExp(escapeRegex(String(query.search).trim()), "i");
    safe.$or = [{ name: regex }, { sku: regex }, { "variants.sku": regex }, { "attributes.value": regex }, { colors: regex }];
  }
  return safe;
}

/**
 * @param {Record<string, unknown>} query
 */
export function buildProductSort(query) {
  const direction = query.sortOrder === "asc" ? 1 : -1;
  if (query.sortBy === "price") return { wholesalePrice: direction };
  if (query.sortBy === "popularity") return { popularityScore: direction, createdAt: -1 };
  return { createdAt: direction };
}

export const productRepository = {
  findByIdOrSlug(idOrSlug) {
    if (mongoose.isValidObjectId(idOrSlug)) {
      return Product.findById(idOrSlug).populate("category", "name slug");
    }
    return Product.findOne({ slug: idOrSlug.toLowerCase() }).populate("category", "name slug");
  },

  async list({ filter, sort, skip, limit }) {
    const [items, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limit).populate("category", "name slug").populate("productType", "name pluralName isActive"),
      Product.countDocuments(filter),
    ]);
    return { items, total };
  },

  create(data) {
    return Product.create(data);
  },

  save(document) {
    return document.save();
  },

  findByIds(ids) {
    return Product.find({ _id: { $in: ids } });
  },
};
