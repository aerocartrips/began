import { apiRequest, type ApiResult } from "@/lib/api/api-client";

/** JSON request to our API; throws ClientApiError (with field errors) on failure. */
export function sendJson<T>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<ApiResult<T>> {
  return apiRequest<T>(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
