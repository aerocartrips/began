import mongoose from "mongoose";
import { Product } from "@/lib/db/models/Product";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { sanitizeMongoFilter } from "@/lib/utils/sanitize";
import { escapeRegex } from "@/lib/utils/escape-regex";

/**
 * @param {Record<string, unknown>} query
 */
export function buildProductFilter(query) {
  /** @type {Record<string, unknown>} */
  const filter = {};

  if (query.search) {
    const term = String(query.search).trim();
    const regex = new RegExp(escapeRegex(term), "i");
    filter.$or = [
      { name: regex },
      { sku: regex },
      { fabric: regex },
      { weavingType: regex },
      { design: regex },
      { colors: regex },
    ];
  }

  if (query.category && mongoose.isValidObjectId(query.category)) {
    filter.category = query.category;
  }

  if (query.fabric) filter.fabric = String(query.fabric);
  if (query.weavingType) filter.weavingType = String(query.weavingType);

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.wholesalePrice = {};
    if (query.minPrice !== undefined) filter.wholesalePrice.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.wholesalePrice.$lte = query.maxPrice;
  }

  if (query.availability === "in_stock") {
    filter.stockQuantity = { $gt: 0 };
    filter.status = PRODUCT_STATUS.ACTIVE;
  } else if (query.availability === "out_of_stock") {
    filter.$or = [{ stockQuantity: { $lte: 0 } }, { status: PRODUCT_STATUS.OUT_OF_STOCK }];
  }

  if (query.status) {
    filter.status = query.status;
  } else if (!query.availability && !query.admin) {
    filter.status = PRODUCT_STATUS.ACTIVE;
  }

  return sanitizeMongoFilter(filter);
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
      Product.find(filter).sort(sort).skip(skip).limit(limit).populate("category", "name slug"),
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
