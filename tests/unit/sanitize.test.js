import { describe, expect, it } from "vitest";
import { buildProductFilter } from "@/lib/repositories/product.repository";
import { sanitizeMongoFilter } from "@/lib/utils/sanitize";

describe("sanitizeMongoFilter", () => {
  it("removes dangerous operator keys", () => {
    const filter = sanitizeMongoFilter({
      name: "saree",
      $where: "malicious",
      "role.name": "admin",
    });
    expect(filter).toEqual({ name: "saree" });
  });

  it("preserves whitelisted $or search filters", () => {
    const filter = sanitizeMongoFilter({
      $or: [{ name: /silk/i }, { sku: /silk/i }],
    });
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0].name).toBeInstanceOf(RegExp);
  });

  it("preserves range operators on fields", () => {
    const filter = sanitizeMongoFilter({
      wholesalePrice: { $gte: 100, $lte: 500 },
      stockQuantity: { $gt: 0 },
    });
    expect(filter).toEqual({
      wholesalePrice: { $gte: 100, $lte: 500 },
      stockQuantity: { $gt: 0 },
    });
  });

  it("buildProductFilter keeps search $or after sanitisation", () => {
    const filter = buildProductFilter({ search: "Jamdani Chiffon", admin: true });
    expect(filter.$or).toHaveLength(6);
    expect(filter.$or[0]).toHaveProperty("name");
  });
});
