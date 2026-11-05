import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { ApiError, isApiError } from "@/lib/utils/api-error";
import { logger } from "@/lib/utils/logger";

/**
 * @param {unknown} data
 * @param {string} message
 * @param {Record<string, unknown> | undefined} meta
 * @param {number} status
 */
export function successResponse(data, message = "Success", meta = undefined, status = 200) {
  return Response.json(
    {
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    },
    { status },
  );
}

/**
 * Converts well-known Mongoose / MongoDB failures into client errors so they
 * do not surface as 500s.
 * @param {unknown} error
 * @returns {ApiError | null}
 */
export function mapDatabaseError(error) {
  if (!error || typeof error !== "object") return null;
  const candidate = /** @type {{ name?: string; code?: number; path?: string; errors?: Record<string, { path?: string; message?: string }>; keyValue?: Record<string, unknown> }} */ (
    error
  );

  if (candidate.name === "CastError") {
    return new ApiError(400, "Invalid identifier.", [
      { field: candidate.path ?? "id", message: "Invalid value." },
    ]);
  }

  if (candidate.name === "ValidationError" && candidate.errors) {
    return new ApiError(
      422,
      "Validation failed.",
      Object.values(candidate.errors).map((issue) => ({
        field: issue.path ?? "unknown",
        message: issue.message ?? "Invalid value.",
      })),
    );
  }

  if (candidate.code === 11000) {
    const fields = Object.keys(candidate.keyValue ?? {});
    return new ApiError(
      409,
      "A record with these details already exists.",
      fields.map((field) => ({ field, message: "Already exists." })),
    );
  }

  return null;
}

/**
 * @param {unknown} error
 * @param {{ requestId?: string; request?: Request }} [context]
 */
export function errorResponse(error, context = {}) {
  const requestId = context.requestId ?? randomUUID();
  const headers = { "x-request-id": requestId };
  const apiError = isApiError(error) ? error : mapDatabaseError(error);

  if (apiError) {
    if (apiError.statusCode >= 500) {
      logger.error("API request failed", { requestId, ...describeRequest(context.request), error });
    }
    if (apiError.statusCode === 429 && Number.isFinite(apiError.retryAfter)) {
      headers["retry-after"] = String(apiError.retryAfter);
    }
    return Response.json(
      {
        success: false,
        message: apiError.message,
        ...(apiError.code ? { code: apiError.code } : {}),
        errors: apiError.errors,
        requestId,
      },
      { status: apiError.statusCode, headers },
    );
  }

  logger.error("Unhandled API error", { requestId, ...describeRequest(context.request), error });
  return Response.json(
    {
      success: false,
      message: "Internal server error",
      errors: [],
      requestId,
    },
    { status: 500, headers },
  );
}

/**
 * @param {Request | undefined} request
 */
function describeRequest(request) {
  if (!request) return {};
  try {
    return { method: request.method, path: new URL(request.url).pathname };
  } catch {
    return { method: request.method };
  }
}

/**
 * @param {(request: Request, context: { params?: Promise<Record<string, string>> }) => Promise<Response>} handler
 */
export function withApiHandler(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Let Next.js control-flow errors (redirect, notFound, prerender bail-outs) propagate.
      unstable_rethrow(error);
      return errorResponse(error, { request });
    }
  };
}
