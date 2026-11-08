import { ApiError } from "@/lib/utils/api-error";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { Order } from "@/lib/db/models/Order";
import { Product } from "@/lib/db/models/Product";
import { STOCK_MOVEMENT_REASON, StockMovement } from "@/lib/db/models/StockMovement";

/**
 * Every stock change goes through this module: an atomic `$inc` on the product
 * (variant and product totals move together) plus a StockMovement ledger row,
 * both in the caller's transaction.
 *
 * Stock is held by an order from reservation until it is released, and
 * `Order.inventoryReserved` says whether it still is. Releasing flips that flag
 * conditionally first, so concurrent cancel / expiry / failure handlers can
 * never return the same stock twice.
 */

/** @typedef {{ productId: unknown, variantId?: unknown, quantity: number }} StockLine */

/** `ApiError.code` when a line cannot be reserved because there is not enough stock. */
export const OUT_OF_STOCK = "out_of_stock";

/** @param {unknown} error */
export const isOutOfStockError = (error) => error instanceof ApiError && error.code === OUT_OF_STOCK;

/** @param {{ product?: unknown, productId?: unknown, variantId?: unknown, quantity: number }} item */
const toLine = (item) => ({ productId: item.productId ?? item.product, variantId: item.variantId ?? null, quantity: item.quantity });

function incrementFor(line, delta) {
  return line.variantId
    ? { $inc: { stockQuantity: delta, "variants.$.stockQuantity": delta } }
    : { $inc: { stockQuantity: delta } };
}

/**
 * @param {StockLine[]} lines
 * @param {number} sign -1 for stock leaving, +1 for stock coming back
 * @param {{ reason: string, order?: unknown, actor?: unknown, session?: import("mongoose").ClientSession }} meta
 */
async function recordMovements(lines, sign, { reason, order = null, actor = null, session }) {
  if (!lines.length) return;
  await StockMovement.insertMany(
    lines.map((line) => ({
      product: line.productId,
      variantId: line.variantId ?? null,
      delta: sign * line.quantity,
      reason,
      order,
      actor,
    })),
    { session },
  );
}

/**
 * Takes stock for every line or none: throws 409 when any line is short (the
 * caller's transaction then rolls back the lines already taken).
 * @param {StockLine[]} items
 * @param {{ session: import("mongoose").ClientSession, order?: unknown, reason?: string }} options
 * @returns {Promise<{ productId: unknown, name: string, previousStock: number, stock: number }[]>}
 *   stock levels after the change, for low-stock alerts once the transaction commits
 */
export async function reserveStock(items, { session, order = null, reason = STOCK_MOVEMENT_REASON.ORDER_RESERVED }) {
  const lines = items.map(toLine);
  const changes = [];
  for (const line of lines) {
    const filter = line.variantId
      ? { _id: line.productId, status: PRODUCT_STATUS.ACTIVE, variants: { $elemMatch: { _id: line.variantId, stockQuantity: { $gte: line.quantity } } } }
      : { _id: line.productId, status: PRODUCT_STATUS.ACTIVE, stockQuantity: { $gte: line.quantity } };
    const updated = await Product.findOneAndUpdate(filter, incrementFor(line, -line.quantity), {
      returnDocument: "after",
      session,
      projection: { name: 1, stockQuantity: 1 },
    });
    if (!updated) {
      throw new ApiError(409, "Inventory changed while placing the order. Please retry.", [], { code: OUT_OF_STOCK });
    }
    changes.push({
      productId: updated._id,
      name: updated.name,
      previousStock: updated.stockQuantity + line.quantity,
      stock: updated.stockQuantity,
    });
  }
  await recordMovements(lines, -1, { reason, order, session });
  return changes;
}

/**
 * Returns an order's held stock, once. Safe to call from any path (payment
 * failure, expiry, cancellation): only the caller that flips
 * `inventoryReserved` from true to false moves stock; later calls are no-ops.
 * @param {unknown} orderId
 * @param {{ session: import("mongoose").ClientSession, actor?: unknown }} options
 * @returns {Promise<boolean>} whether this call released the stock
 */
export async function releaseOrderStock(orderId, { session, actor = null }) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, inventoryReserved: true },
    { $set: { inventoryReserved: false } },
    { session, projection: { items: 1 } },
  ).lean();
  if (!order) return false;

  const returned = [];
  for (const line of order.items.map(toLine)) {
    const filter = line.variantId ? { _id: line.productId, "variants._id": line.variantId } : { _id: line.productId };
    const result = await Product.updateOne(filter, incrementFor(line, line.quantity), { session });
    // A colour deleted since the order was placed has nowhere to return stock to.
    if (result.matchedCount > 0) returned.push(line);
  }
  await recordMovements(returned, 1, { reason: STOCK_MOVEMENT_REASON.ORDER_RELEASED, order: orderId, actor, session });
  return true;
}

/**
 * Records admin stock edits already applied to a product document in the same
 * transaction (see product.service.js).
 * @param {{ productId: unknown, variantId?: unknown, delta: number }[]} adjustments
 * @param {{ session: import("mongoose").ClientSession, actor?: unknown }} options
 */
export async function recordAdminStockChanges(adjustments, { session, actor = null }) {
  const changed = adjustments.filter((entry) => entry.delta !== 0);
  if (!changed.length) return;
  await StockMovement.insertMany(
    changed.map((entry) => ({
      product: entry.productId,
      variantId: entry.variantId ?? null,
      delta: entry.delta,
      reason: STOCK_MOVEMENT_REASON.ADMIN_SET,
      actor,
    })),
    { session },
  );
}

export { STOCK_MOVEMENT_REASON };
