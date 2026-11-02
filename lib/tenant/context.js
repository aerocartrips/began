import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped tenant context. Every database operation on a tenant-owned
 * model reads the tenant from here (see lib/db/plugins/tenant-scope.js), so a
 * code path that forgets to establish a tenant fails instead of leaking data.
 *
 * @typedef {{ tenantId: string, tenant?: import("@/lib/tenant/types").PublicTenant }} TenantContext
 */

/** @type {AsyncLocalStorage<TenantContext>} */
const storage = globalThis.__norosilkTenantStorage ?? new AsyncLocalStorage();
globalThis.__norosilkTenantStorage = storage;

/**
 * @template T
 * @param {string | { _id?: unknown, id?: string }} tenant tenant id or tenant object
 * @param {() => T} callback
 * @returns {T}
 */
export function runWithTenant(tenant, callback) {
  const tenantId = typeof tenant === "string" ? tenant : String(tenant.id ?? tenant._id);
  if (!tenantId || tenantId === "undefined") {
    throw new Error("runWithTenant requires a tenant id.");
  }
  const context = typeof tenant === "string" ? { tenantId } : { tenantId, tenant };
  return storage.run(context, () => {
    const result = callback();
    // Mongoose queries are lazy thenables that execute when awaited. Resolving
    // here starts them inside the tenant context instead of after it has exited.
    return result && typeof result.then === "function" ? Promise.resolve(result) : result;
  });
}

/**
 * Sets the tenant for the rest of the current async flow. For tests and
 * one-off scripts only; request code must use runWithTenant().
 * @param {string} tenantId
 */
export function enterTenantContext(tenantId) {
  storage.enterWith({ tenantId });
}

/** @returns {TenantContext | undefined} */
export function getTenantContext() {
  return storage.getStore();
}

/** @returns {string} */
export function requireTenantId() {
  const context = storage.getStore();
  if (!context) {
    throw new Error("No tenant context: wrap this operation in runWithTenant().");
  }
  return context.tenantId;
}
