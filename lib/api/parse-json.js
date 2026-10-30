import { ApiError } from "@/lib/utils/api-error";

/**
 * @param {Request} request
 * @param {number} [maxBytes]
 */
export async function parseJsonBody(request, maxBytes = 32 * 1024) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new ApiError(413, "Request body too large.");
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "Invalid JSON body.");
  }
}
