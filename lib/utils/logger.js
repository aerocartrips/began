/**
 * Minimal structured logger. Emits one JSON line per event so hosted log
 * drains (Vercel, Datadog, etc.) can parse fields without extra setup.
 */

/**
 * @param {unknown} error
 */
function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.cause ? { cause: serializeError(error.cause) } : {}),
    };
  }
  return { message: String(error) };
}

/**
 * @param {"info" | "warn" | "error"} level
 * @param {string} message
 * @param {Record<string, unknown>} [context]
 */
function write(level, message, context = {}) {
  const { error, ...rest } = context;
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...rest,
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  /** @param {string} message @param {Record<string, unknown>} [context] */
  info: (message, context) => write("info", message, context),
  /** @param {string} message @param {Record<string, unknown>} [context] */
  warn: (message, context) => write("warn", message, context),
  /** @param {string} message @param {Record<string, unknown>} [context] */
  error: (message, context) => write("error", message, context),
};
