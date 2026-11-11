import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { ApiError } from "@/lib/utils/api-error";
import { errorResponse, withApiHandler } from "@/lib/utils/api-response";
import { runWithTenant } from "@/lib/tenant/context";
import { getRequestTenant } from "@/lib/tenant/current";
import { requestOrigin } from "@/lib/tenant/host";

/**
 * @typedef {{ params?: Promise<Record<string, string>>, tenant?: import("@/lib/tenant/types").PublicTenant }} RouteContext
 * @typedef {{ tenant?: boolean }} WithDatabaseOptions
 */

/**
 * Connects to MongoDB and, by default, resolves the store from the request's
 * Host header and runs the handler inside that tenant's context. The tenant is
 * also passed to the handler as `context.tenant`.
 *
 * Use `{ tenant: false }` only for platform routes (cron jobs) that iterate
 * stores themselves.
 * @param {(request: Request, context: RouteContext) => Promise<Response>} handler
 * @param {WithDatabaseOptions} [options]
 */
export function withDatabase(handler, options = {}) {
  const scopeToTenant = options.tenant ?? true;
  return withApiHandler(async (request, context = {}) => {
    // Reading the host first also marks the route as request-time for the build.
    const host = request.headers.get("host") ?? new URL(request.url).host;
    if (!isDatabaseConfigured()) {
      throw new ApiError(503, "Database is not configured. Set MONGODB_URI.");
    }
    await connectDB();
    if (!scopeToTenant) return handler(request, context);

    const tenant = await getRequestTenant(host);
    // The host resolved to this store, so it is one of the store's own domains:
    // links built during the request (emails) lead back to it.
    return runWithTenant(tenant, () => handler(request, { ...context, tenant }), { origin: requestOrigin(host) });
  });
}

export function databaseUnavailableResponse() {
  return errorResponse(new ApiError(503, "Database is not configured. Set MONGODB_URI."));
}
