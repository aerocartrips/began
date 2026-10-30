import { ApiError } from "@/lib/utils/api-error";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * @param {URLSearchParams} searchParams
 */
export function parsePagination(searchParams) {
  const pageRaw = Number(searchParams.get("page") ?? DEFAULT_PAGE);
  const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : DEFAULT_PAGE;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
      : DEFAULT_LIMIT;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 */
export function buildPaginationMeta(total, page, limit) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { page, limit, total, totalPages };
}

/**
 * @param {string | null | undefined} sortBy
 * @param {string | null | undefined} sortOrder
 * @param {Record<string, 1 | -1>} allowedFields
 */
export function parseSort(sortBy, sortOrder, allowedFields) {
  const field = sortBy && allowedFields[sortBy] ? sortBy : "createdAt";
  const direction = sortOrder === "asc" ? 1 : -1;
  return { [field]: allowedFields[field] ?? direction };
}

/**
 * @param {URLSearchParams} searchParams
 * @param {string} key
 * @param {number} min
 * @param {number} max
 */
export function parseNumberParam(searchParams, key, min, max) {
  const raw = searchParams.get(key);
  if (raw === null || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ApiError(400, `Invalid ${key} parameter.`);
  }
  return value;
}
