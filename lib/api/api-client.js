import {
  ClientApiError,
  clientErrorFromResponse,
  normalizeClientApiError,
} from "@/lib/api/api-error";

/**
 * @typedef {{
 *   method?: string;
 *   headers?: HeadersInit;
 *   body?: BodyInit | null;
 *   credentials?: RequestCredentials;
 *   cache?: RequestCache;
 *   signal?: AbortSignal;
 *   parseJson?: boolean;
 * }} ApiRequestOptions
 */

/**
 * @template T
 * @typedef {{
 *   ok: boolean;
 *   status: number;
 *   data: T | null;
 *   message: string;
 *   errors: { field: string; message: string }[];
 *   response: Response;
 * }} ApiResult
 */

/**
 * @template T
 * @param {string} input
 * @param {ApiRequestOptions} [options]
 * @returns {Promise<ApiResult<T>>}
 */
export async function apiRequest(input, options = {}) {
  const {
    method = "GET",
    headers,
    body = undefined,
    credentials = "include",
    cache = "no-store",
    signal,
    parseJson = true,
  } = options;

  let response;
  try {
    response = await fetch(input, {
      method,
      headers,
      body,
      credentials,
      cache,
      signal,
    });
  } catch (error) {
    throw normalizeClientApiError(error);
  }

  if (!parseJson) {
    if (!response.ok) {
      throw new ClientApiError("Something went wrong. Please try again.", {
        status: response.status,
      });
    }
    return {
      ok: true,
      status: response.status,
      data: null,
      message: "",
      errors: [],
      response,
    };
  }

  let bodyJson = null;
  try {
    bodyJson = await response.json();
  } catch {
    if (!response.ok) {
      throw new ClientApiError("Something went wrong. Please try again.", {
        status: response.status,
      });
    }
    return {
      ok: true,
      status: response.status,
      data: null,
      message: "",
      errors: [],
      response,
    };
  }

  const envelope =
    bodyJson && typeof bodyJson === "object"
      ? /** @type {{ success?: boolean; message?: string; data?: T; meta?: Record<string, unknown>; errors?: { field: string; message: string }[] }} */ (
          bodyJson
        )
      : {};

  const success = Boolean(envelope.success) && response.ok;
  if (!success) {
    throw clientErrorFromResponse(response, bodyJson);
  }

  return {
    ok: true,
    status: response.status,
    data: envelope.data ?? null,
    meta: envelope.meta ?? null,
    message: envelope.message ?? "",
    errors: envelope.errors ?? [],
    response,
  };
}
