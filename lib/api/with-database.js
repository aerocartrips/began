import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { ApiError } from "@/lib/utils/api-error";
import { errorResponse, withApiHandler } from "@/lib/utils/api-response";

/**
 * @param {(request: Request, context: { params?: Promise<Record<string, string>> }) => Promise<Response>} handler
 */
export function withDatabase(handler) {
  return withApiHandler(async (request, context) => {
    if (!isDatabaseConfigured()) {
      throw new ApiError(503, "Database is not configured. Set MONGODB_URI.");
    }
    await connectDB();
    return handler(request, context);
  });
}

export function databaseUnavailableResponse() {
  return errorResponse(new ApiError(503, "Database is not configured. Set MONGODB_URI."));
}
