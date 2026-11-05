import {
  ClientApiError,
  clientErrorFromResponse,
  normalizeClientApiError,
} from "@/lib/api/api-error";
import { SESSION_EXPIRED_CODE } from "@/lib/auth/cookies";

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

/** @type {Promise<boolean> | null} */
let refreshInFlight = null;

/**
 * Renews the customer session from its refresh cookie. Concurrent callers
 * share one request, so a burst of expired calls costs a single refresh.
 * @returns {Promise<boolean>} whether the session was renewed
 */
export function refreshSession() {
  refreshInFlight ??= fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include", cache: "no-store" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * Only a 401 the server marks as `session_expired` (the access token expired,
 * a refresh cookie exists) is worth a refresh; signed-out visitors cost nothing
 * extra. Admin pages use their own session and never renew the customer one.
 * @param {Response} response
 */
async function canRenew(response) {
  if (response.status !== 401) return false;
  if (typeof window !== "undefined" && /^\/admin(\/|$)/.test(window.location.pathname)) return false;
  const body = await response.clone().json().catch(() => null);
  return body?.code === SESSION_EXPIRED_CODE;
}

/**
 * `fetch` for this store's API that survives access-token expiry: a
 * `session_expired` 401 refreshes the session once and repeats the request.
 * The request body must be replayable (string, FormData, Blob…), as all ours are.
 * @param {string} input
 * @param {RequestInit} [init]
 */
export async function fetchWithSession(input, init = {}) {
  const request = { credentials: /** @type {RequestCredentials} */ ("include"), ...init };
  const response = await fetch(input, request);
  if (!(await canRenew(response)) || !(await refreshSession())) return response;
  return fetch(input, request);
}

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
    response = await fetchWithSession(input, {
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
