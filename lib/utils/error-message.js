/**
 * Maps HTTP status codes and common failure modes to user-facing copy.
 * @param {number | undefined} status
 * @param {string | undefined} [fallbackMessage]
 * @returns {string}
 */
export function messageForHttpStatus(status, fallbackMessage) {
  if (fallbackMessage && status !== 500 && status !== 502 && status !== 503) {
    return fallbackMessage;
  }

  switch (status) {
    case 400:
      return "Please check the information you entered.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "The requested information could not be found.";
    case 408:
      return "The request timed out. Please try again.";
    case 413:
      return "The request was too large. Please reduce what you are sending.";
    case 422:
      return "Please check the information you entered.";
    case 429:
      return "Too many requests. Please wait and try again.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "Something went wrong. Please try again.";
    default:
      return fallbackMessage || "Something went wrong. Please try again.";
  }
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function messageForNetworkError(error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The request was cancelled.";
  }
  return "We could not reach the server. Check your connection and try again.";
}
