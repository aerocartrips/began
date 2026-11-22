import { describe, expect, it } from "vitest";
import { buildFilters, facetGroupsFrom, facetPipelines, parseCatalogQuery } from "@/lib/catalog/query";
import { facetKeysFor, filterKeysFor } from "@/lib/catalog/catalog-config";
import { catalogHref, filterCount, hasActiveFilters, toggleValue } from "@/features/catalog/query-string";

/** A store selling sarees (colour option) and T-shirts (colour × size), with a shared Fabric detail. */
const attribute = (key, name, input, values, extra = {}) => ({
  key,
  name,
  input,
  unit: "",
  filterable: true,
  visible: true,
  schemaProperty: "",
  values: values.map((label) => (Array.isArray(label) ? { label: label[0], hex: label[1] } : { label, hex: "" })),
  ...extra,
});
const config = {
  types: [
    { id: "a".repeat(24), name: "Saree", pluralName: "Sarees", slug: "sarees", icon: "sparkles", description: "", template: "saree", fields: [{ key: "fabric", required: true }, { key: "weave", required: false }], options: [{ key: "color", values: [] }], sizeChart: null, productCount: 3 },
    { id: "b".repeat(24), name: "T-shirt", pluralName: "T-shirts", slug: "t-shirts", icon: "shirt", description: "", template: "t-shirt", fields: [{ key: "fabric", required: true }, { key: "fit", required: false }, { key: "length", required: false }], options: [{ key: "color", values: [] }, { key: "size", values: ["S", "M", "L", "XL"] }], sizeChart: null, productCount: 2 },
  ],
  attributes: {
    color: attribute("color", "Colour", "color", [["Red", "#c62a2a"], ["Blue", "#2f6fd0"]], { schemaProperty: "color" }),
    size: attribute("size", "Size", "select", ["XS", "S", "M", "L", "XL"], { schemaProperty: "size" }),
    fabric: attribute("fabric", "Fabric", "select", ["Pure Silk", "Cotton"]),
    weave: attribute("weave", "Weave", "select", ["Banarasi"]),
    fit: attribute("fit", "Fit", "select", ["Slim", "Regular"]),
    // Not a filter: never read from the URL.
    length: attribute("length", "Length", "text", [], { filterable: false }),
  },
  untypedCount: 0,
};

describe("parseCatalogQuery", () => {
  it("reads every filterable attribute from the URL, de-duplicated and in the list's spelling", () => {
    const query = parseCatalogQuery({ fabric: ["pure silk", "Pure Silk", " Cotton "], size: "m", min: "5000", max: "1000", page: "3", stock: "1", length: "Long" }, {}, config);
    expect(query.filters).toEqual({ fabric: ["Pure Silk", "Cotton"], size: ["M"] });
    expect([query.minPrice, query.maxPrice]).toEqual([1000, 5000]);
    expect(query.page).toBe(3);
    expect(query.inStock).toBe(true);
    expect(query.sort).toBe("newest");
  });

  it("keeps values outside the list (they match nothing) and ignores unknown parameters", () => {
    const query = parseCatalogQuery({ fabric: "Velvet", utm_source: "x", hacker: "1" }, {}, config);
    expect(query.filters).toEqual({ fabric: ["Velvet"] });
  });

  it("drops invalid values instead of throwing", () => {
    const query = parseCatalogQuery({ min: "abc", page: "-4", sort: "drop table", q: "x".repeat(500) }, {}, config);
    expect(query.minPrice).toBeNull();
    expect(query.page).toBe(1);
    expect(query.sort).toBe("relevance");
    expect(query.q).toHaveLength(100);
  });

  it("caps deep pages and lets the route fix the category and type", () => {
    expect(parseCatalogQuery({ page: "99999" }, {}, config).page).toBe(200);
    expect(parseCatalogQuery({ category: "ignored" }, { category: "banarasi" }, config).category).toBe("banarasi");
    expect(parseCatalogQuery({ type: "sarees" }, { type: "t-shirts" }, config).type).toBe("t-shirts");
    expect(parseCatalogQuery({ fabric: "Silk" }).filters).toEqual({});
  });
});

describe("filter scope", () => {
  it("offers a type's own filters, options first, and only the shared ones on a mixed listing", () => {
    expect(facetKeysFor(config, config.types[1])).toEqual([
      { key: "color", source: "option" },
      { key: "size", source: "option" },
      { key: "fabric", source: "attribute" },
      { key: "fit", source: "attribute" },
    ]);
    // Sarees and T-shirts share colour and fabric; weave, size and fit belong to one type each.
    expect(facetKeysFor(config, null).map((facet) => facet.key)).toEqual(["color", "fabric"]);
    // A store stocking one type offers all of its filters everywhere.
    const sareesOnly = { ...config, types: [config.types[0], { ...config.types[1], productCount: 0 }] };
    expect(facetKeysFor(sareesOnly, null).map((facet) => facet.key)).toEqual(["color", "fabric", "weave"]);
  });

  it("still applies a filter the listing doesn't offer, so older links keep working", () => {
    const keys = filterKeysFor(config, null, { weave: ["Banarasi"], length: ["Long"] });
    expect(keys.map((facet) => facet.key)).toEqual(["color", "fabric", "weave"]);
    expect(keys.at(-1)).toEqual({ key: "weave", source: "attribute" });
  });

  it("matches options on one variant together, in stock when asked, and details on the product", () => {
    const query = parseCatalogQuery({ color: "Red", size: "M", fabric: "Cotton", stock: "1" }, { type: "t-shirts" }, config);
    const filters = buildFilters(query, "retail", [], "text", config.types[1], facetKeysFor(config, config.types[1]));
    expect(filters.base).toMatchObject({ status: "active", typeHidden: { $ne: true }, stockQuantity: { $gt: 0 } });
    expect(String(filters.base.productType)).toBe("b".repeat(24));
    expect(filters.productClauses).toEqual({ fabric: { attributes: { $elemMatch: { key: "fabric", value: { $in: ["Cotton"] } } } } });
    expect(filters.variantConditions).toEqual({ color: { "options.color": { $in: ["Red"] } }, size: { "options.size": { $in: ["M"] } } });
  });

  it("counts a filter group without its own selection, so shoppers can pick several values", () => {
    const query = parseCatalogQuery({ size: "M", fabric: "Cotton" }, { type: "t-shirts" }, config);
    const keys = facetKeysFor(config, config.types[1]);
    const pipelines = facetPipelines(keys, buildFilters(query, "retail", [], "text", config.types[1], keys));
    // Colour and fit share one pipeline per source; size and fabric (selected) get their own.
    expect(Object.keys(pipelines).sort()).toEqual(["details", "details2", "options", "options1"]);
    const sizeMatch = pipelines.options1.find((stage) => stage.$match && stage.$match["variants.options.size"]);
    expect(sizeMatch).toBeUndefined();
    const fabricGroup = JSON.stringify(pipelines.details2);
    expect(fabricGroup).not.toContain("Cotton");
    expect(fabricGroup).toContain("options.size");
  });

  it("orders sizes naturally and other values by how many products have them", () => {
    const result = {
      options: [{ _id: "size", values: [{ value: "XL", count: 9 }, { value: "S", count: 2 }, { value: "M", count: 5 }] }],
      details: [{ _id: "fabric", values: [{ value: "Pure Silk", count: 1 }, { value: "Cotton", count: 4 }] }],
      total: [{ n: 9 }],
    };
    const keys = [{ key: "size", source: "option" }, { key: "fabric", source: "attribute" }];
    const groups = facetGroupsFrom(result, keys, config, config.types[1]);
    expect(groups.map((group) => [group.key, group.values.map((value) => value.value)])).toEqual([
      ["size", ["S", "M", "XL"]],
      ["fabric", ["Cotton", "Pure Silk"]],
    ]);
  });

  it("adds counts of an attribute that is a detail in one type and an option in another", () => {
    const result = { details: [{ _id: "color", values: [{ value: "Red", count: 2 }] }], options: [{ _id: "color", values: [{ value: "Red", count: 3 }] }] };
    const [group] = facetGroupsFrom(result, [{ key: "color", source: "both" }], config, null);
    expect(group.values).toEqual([{ value: "Red", count: 5, hex: "#c62a2a" }]);
  });
});

describe("catalogHref", () => {
  const base = parseCatalogQuery({}, {}, config);

  it("builds stable URLs (filters in key order) and resets the page on filter changes", () => {
    const query = { ...base, page: 4, filters: { size: ["M"], fabric: ["Silk"] } };
    expect(catalogHref("/products", query, { filters: { fabric: toggleValue(query.filters.fabric, "Cotton") } })).toBe(
      "/products?fabric=Silk&fabric=Cotton&size=M",
    );
    expect(catalogHref("/products", query, { page: 5 })).toBe("/products?fabric=Silk&size=M&page=5");
    expect(catalogHref("/categories/banarasi", { ...base, category: "banarasi" })).toBe("/categories/banarasi");
    expect(catalogHref("/shop/t-shirts", { ...base, type: "t-shirts", filters: { size: ["L"] } })).toBe("/shop/t-shirts?size=L");
    expect(catalogHref("/products", { ...base, type: "t-shirts" })).toBe("/products?type=t-shirts");
    expect(hasActiveFilters(base)).toBe(false);
    expect(filterCount(query)).toBe(2);
  });
});
