export class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {{ field: string, message: string }[]} [errors]
   * @param {{ code?: string }} [options] `code` is a stable, machine-readable reason sent with the error.
   */
  constructor(statusCode, message, errors = [], options = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = options.code;
  }
}

export function isApiError(error) {
  return error instanceof ApiError;
}
