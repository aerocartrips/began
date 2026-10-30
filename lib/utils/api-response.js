import { ApiError, isApiError } from "@/lib/utils/api-error";

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

export function errorResponse(error) {
  if (isApiError(error)) {
    return Response.json(
      {
        success: false,
        message: error.message,
        errors: error.errors,
      },
      { status: error.statusCode },
    );
  }

  return Response.json(
    {
      success: false,
      message: "Internal server error",
      errors: [],
    },
    { status: 500 },
  );
}

/**
 * @param {(request: Request, context: { params?: Promise<Record<string, string>> }) => Promise<Response>} handler
 */
export function withApiHandler(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
