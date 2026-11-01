import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ validateEnv }, { logger }] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/utils/logger"),
  ]);
  const { errors, warnings } = validateEnv();

  for (const warning of warnings) logger.warn(`Configuration: ${warning}`);
  if (errors.length === 0) return;

  for (const error of errors) logger.error(`Configuration: ${error}`);
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Invalid server configuration:\n- ${errors.join("\n- ")}`);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { logger } = await import("@/lib/utils/logger");
  logger.error("Server request error", {
    error,
    digest:
      typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined,
    method: request.method,
    path: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
