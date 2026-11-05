import { messageForHttpStatus, messageForNetworkError } from "@/lib/utils/error-message";

/**
 * Client-side API failure (distinct from server {@link ApiError} in lib/utils/api-error.js).
 */
export class ClientApiError extends Error {
  /**
   * @param {string} message
   * @param {{
   *   status?: number;
   *   errors?: { field: string; message: string }[];
   *   cause?: unknown;
   *   raw?: unknown;
   * }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = "ClientApiError";
    this.status = options.status;
    this.errors = options.errors ?? [];
    this.cause = options.cause;
    this.raw = options.raw;
  }
}

/**
 * @param {unknown} error
 * @returns {error is ClientApiError}
 */
export function isClientApiError(error) {
  return error instanceof ClientApiError;
}

/**
 * The request needs a signed-in shopper and the session is gone (an expired
 * access token has already been renewed by the API client at this point).
 * @param {unknown} error
 * @returns {error is ClientApiError}
 */
export function isUnauthorizedError(error) {
  return error instanceof ClientApiError && error.status === 401;
}

/**
 * @param {Response} response
 * @param {unknown} body
 * @returns {ClientApiError}
 */
export function clientErrorFromResponse(response, body) {
  const payload = body && typeof body === "object" ? /** @type {Record<string, unknown>} */ (body) : {};
  const serverMessage = typeof payload.message === "string" ? payload.message : undefined;
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const message = messageForHttpStatus(response.status, serverMessage);
  return new ClientApiError(message, {
    status: response.status,
    errors,
    raw: body,
  });
}

/**
 * @param {unknown} error
 * @returns {ClientApiError}
 */
export function normalizeClientApiError(error) {
  if (error instanceof ClientApiError) return error;
  if (error instanceof TypeError) {
    return new ClientApiError(messageForNetworkError(error), { cause: error });
  }
  return new ClientApiError("Something went wrong. Please try again.", { cause: error });
}
