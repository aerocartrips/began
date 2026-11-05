import { logger } from "@/lib/utils/logger";

const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;
const MAX_BYTES = 1_500_000;

/** @type {Map<string, { at: number, buffer: Buffer | null }>} */
const cache = new Map();

/**
 * PNG rendition of a store logo, for PDFKit (PNG/JPEG only). Only Cloudinary
 * logos are fetched: the server never requests a host a tenant typed in.
 */
function pngSource(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com" || !parsed.pathname.includes("/image/upload/")) {
      return null;
    }
    parsed.pathname = parsed.pathname.replace("/image/upload/", "/image/upload/f_png,h_160,c_limit/");
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * The store logo as an image buffer for the invoice header, or null (the
 * header then shows the store name). Cached in memory per URL.
 * @param {string | undefined} url
 * @returns {Promise<Buffer | null>}
 */
export async function loadInvoiceLogo(url) {
  const source = url ? pngSource(url) : null;
  if (!source) return null;
  const cached = cache.get(source);
  if (cached && Date.now() - cached.at < (cached.buffer ? SUCCESS_TTL_MS : FAILURE_TTL_MS)) return cached.buffer;

  let buffer = null;
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(2500) });
    const type = response.headers.get("content-type") ?? "";
    if (response.ok && /^image\/(png|jpe?g)/.test(type)) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length <= MAX_BYTES) buffer = bytes;
    }
  } catch (error) {
    logger.warn("Invoice logo unavailable", { source, error });
  }
  cache.set(source, { at: Date.now(), buffer });
  return buffer;
}
