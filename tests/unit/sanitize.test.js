import { describe, expect, it } from "vitest";
import { sanitizeMongoFilter } from "@/lib/utils/sanitize";

describe("sanitize", () => {
  it("removes operator keys from filters", () => {
    const filter = sanitizeMongoFilter({
      name: "saree",
      $where: "malicious",
      "role.name": "admin",
    });
    expect(filter).toEqual({ name: "saree" });
  });
});
