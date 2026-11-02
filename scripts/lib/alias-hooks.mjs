import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const root = pathToFileURL(resolvePath(import.meta.dirname, "../..") + "/").href;
const EXTENSIONS = ["", ".js", ".mjs", "/index.js"];

export async function resolve(specifier, context, nextResolve) {
  const target = specifier.startsWith("@/") ? root + specifier.slice(2) : specifier;
  let lastError;
  for (const extension of EXTENSIONS) {
    try {
      return await nextResolve(target + extension, context);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND" && error?.code !== "ERR_UNSUPPORTED_DIR_IMPORT") throw error;
      lastError = error;
    }
  }
  throw lastError;
}
