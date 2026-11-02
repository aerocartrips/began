import { describe, expect, it } from "vitest";
import { parseCatalogQuery } from "@/lib/catalog/query";
import { catalogHref, hasActiveFilters, toggleValue } from "@/features/catalog/query-string";

describe("parseCatalogQuery", () => {
  it("normalises multi-value filters, prices and paging", () => {
    const query = parseCatalogQuery({ fabric: ["Silk", "Silk", " Cotton "], min: "5000", max: "1000", page: "3", stock: "1" });
    expect(query.fabric).toEqual(["Silk", "Cotton"]);
    expect([query.minPrice, query.maxPrice]).toEqual([1000, 5000]);
    expect(query.page).toBe(3);
    expect(query.inStock).toBe(true);
    expect(query.sort).toBe("newest");
  });

  it("drops invalid values instead of throwing", () => {
    const query = parseCatalogQuery({ min: "abc", page: "-4", sort: "drop table", q: "x".repeat(500) });
    expect(query.minPrice).toBeNull();
    expect(query.page).toBe(1);
    expect(query.sort).toBe("relevance");
    expect(query.q).toHaveLength(100);
  });

  it("caps deep pages and lets the route fix the category", () => {
    expect(parseCatalogQuery({ page: "99999" }).page).toBe(200);
    expect(parseCatalogQuery({ category: "ignored" }, { category: "banarasi" }).category).toBe("banarasi");
  });
});

describe("catalogHref", () => {
  const base = parseCatalogQuery({});

  it("builds stable URLs and resets the page on filter changes", () => {
    const query = { ...base, page: 4, fabric: ["Silk"] };
    expect(catalogHref("/products", query, { fabric: toggleValue(query.fabric, "Cotton") })).toBe("/products?fabric=Silk&fabric=Cotton");
    expect(catalogHref("/products", query, { page: 5 })).toBe("/products?fabric=Silk&page=5");
    expect(catalogHref("/categories/banarasi", { ...base, category: "banarasi" })).toBe("/categories/banarasi");
    expect(hasActiveFilters(base)).toBe(false);
  });
});
