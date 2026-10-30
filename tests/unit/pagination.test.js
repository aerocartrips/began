import { describe, expect, it } from "vitest";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";

describe("pagination", () => {
  it("parses page and limit with defaults", () => {
    const params = new URLSearchParams();
    const result = parsePagination(params);
    expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("caps limit at 100", () => {
    const params = new URLSearchParams({ page: "2", limit: "500" });
    const result = parsePagination(params);
    expect(result.limit).toBe(100);
    expect(result.skip).toBe(100);
  });

  it("builds meta", () => {
    expect(buildPaginationMeta(45, 2, 20)).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });
});
