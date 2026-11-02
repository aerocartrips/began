import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";

const MODELS_DIR = path.resolve(import.meta.dirname, "../../lib/db/models");
const PLATFORM_MODELS = new Set(["Tenant", "RateLimit"]);

const modelNames = readdirSync(MODELS_DIR)
  .filter((file) => file.endsWith(".js"))
  .map((file) => file.replace(/\.js$/, ""))
  .filter((name) => !PLATFORM_MODELS.has(name));

describe.each(modelNames)("%s model", (name) => {
  it("is tenant-scoped and every index starts with tenantId", async () => {
    const Model = (await import(`@/lib/db/models/${name}`))[name];
    expect(Model.schema.path("tenantId"), `${name} must use tenantScopePlugin`).toBeDefined();

    for (const [fields, options] of Model.schema.indexes()) {
      if (options?.expireAfterSeconds !== undefined) continue; // TTL indexes must be single-field
      expect(Object.keys(fields)[0], `${name} index ${JSON.stringify(fields)}`).toBe("tenantId");
    }
  });
});
