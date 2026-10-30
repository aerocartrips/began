export class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {{ field: string, message: string }[]} [errors]
   */
  constructor(statusCode, message, errors = []) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export function isApiError(error) {
  return error instanceof ApiError;
}
