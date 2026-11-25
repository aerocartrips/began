/**
 * Product types without a database: variant helpers, size charts and the fit
 * finder, attribute values, the type and attribute validators, and the
 * integrity of the built-in templates.
 */
import { describe, expect, it } from "vitest";
import { combinationKey, optionCombinations, optionsOf, searchTextOf, sizeRangeOf, variantSkuOf, variantTitleOf } from "@/lib/catalog/variants";
import { convertCell, parseMeasure, primaryColumnIndex, recommendSize } from "@/lib/catalog/size-chart";
import { attributeRecordOf, canonicalizeValue, formatAttributeValues } from "@/lib/catalog/attribute-values";
import { ATTRIBUTE_PRESETS, TYPE_TEMPLATES, typeTemplateSummaries } from "@/lib/catalog/type-templates";
import { attributeKeyFrom, createAttributeSchema, createProductTypeSchema, sizeChartInputSchema } from "@/lib/validators/catalog-setup.validator";
import { createProductInputSchema } from "@/lib/validators/product.validator";
import { OPTION_INPUTS, RESERVED_ATTRIBUTE_KEYS } from "@/lib/constants/catalog";
import { pluralOf } from "@/lib/services/product-type.service";

describe("variants", () => {
  it("titles a variant from its options in order, whatever shape they arrive in", () => {
    expect(variantTitleOf({ color: "Red", size: "M" })).toBe("Red / M");
    expect(variantTitleOf(new Map([["size", "L"]]))).toBe("L");
    expect(variantTitleOf({}, "Teal")).toBe("Teal");
    expect(optionsOf({ options: new Map([["color", "Red"]]) })).toEqual({ color: "Red" });
    expect(optionsOf(null)).toEqual({});
  });

  it("builds every combination with the first option varying slowest", () => {
    expect(optionCombinations([{ key: "color", values: ["Red", "Blue"] }, { key: "size", values: ["S", "M"] }])).toEqual([
      { color: "Red", size: "S" },
      { color: "Red", size: "M" },
      { color: "Blue", size: "S" },
      { color: "Blue", size: "M" },
    ]);
    expect(optionCombinations([{ key: "color", values: [] }])).toEqual([]);
    expect(combinationKey({ size: "M", color: "Red" })).toBe(combinationKey({ color: "Red", size: "M" }));
  });

  it("summarises sizes in the type's order and makes short SKUs", () => {
    expect(sizeRangeOf(["XL", "S", "M", "L", "S"], ["XS", "S", "M", "L", "XL"])).toBe("S–XL");
    expect(sizeRangeOf(["32", "28"], ["28", "30", "32"])).toBe("28, 32");
    expect(sizeRangeOf([], [])).toBe("");
    // Sizes that are ranges themselves don't run together.
    expect(sizeRangeOf(["2–3Y", "3–4Y", "4–5Y", "7–8Y"], ["2–3Y", "3–4Y", "4–5Y", "7–8Y"])).toBe("2–3Y to 7–8Y");
    expect(variantSkuOf("TEE-01", ["Navy Blue", "XL"])).toBe("TEE-01-NAVYBLU-XL");
  });

  it("indexes detail and option values for search", () => {
    const text = searchTextOf({ attributes: [{ key: "fabric", value: "Linen" }], variants: [{ options: { color: "Teal", size: "M" } }], colors: ["Teal"] });
    expect(text.split(" ")).toEqual(["Linen", "Teal", "M"]);
  });
});

describe("size charts", () => {
  const chart = {
    optionKey: "size",
    unit: "in",
    columns: [{ label: "Chest", primary: true, measurement: true }, { label: "EU", primary: false, measurement: false }],
    rows: [
      { size: "S", values: ["36–38", "44"] },
      { size: "M", values: ["39–41", "48"] },
      { size: "L", values: ["42–44", "52"] },
    ],
    note: "",
    howToMeasure: [],
  };

  it("reads ranges and converts lengths between inches and centimetres", () => {
    expect(parseMeasure("38–40")).toEqual({ min: 38, max: 40 });
    expect(parseMeasure("80-92")).toEqual({ min: 80, max: 92 });
    expect(parseMeasure("Free")).toBeNull();
    expect(convertCell("38–40", "in", "cm")).toBe("96.5–101.6");
    expect(convertCell("One size", "in", "cm")).toBe("One size");
    expect(primaryColumnIndex(chart)).toBe(0);
  });

  it("suggests a size from one measurement, the larger between two, and the ends beyond the chart", () => {
    expect(recommendSize(chart, 40, "in")).toEqual({ size: "M", fit: "within" });
    // 38.6 in sits between S (to 38) and M (from 39).
    expect(recommendSize(chart, 38.6, "in")).toEqual({ size: "M", fit: "between" });
    expect(recommendSize(chart, 30, "in")).toEqual({ size: "S", fit: "below" });
    expect(recommendSize(chart, 50, "in")).toEqual({ size: "L", fit: "above" });
    // The same body measured in centimetres.
    expect(recommendSize(chart, 101.6, "cm")).toEqual({ size: "M", fit: "within" });
    expect(recommendSize(chart, 0, "in")).toBeNull();
  });
});

describe("attribute values", () => {
  const fabric = { key: "fabric", name: "Fabric", input: "select", values: [{ label: "Pure Silk" }, { label: "Cotton" }] };

  it("stores list values in the list's spelling and refuses others", () => {
    expect(canonicalizeValue(fabric, " pure silk ")).toEqual({ value: "Pure Silk" });
    expect(canonicalizeValue(fabric, "Velvet")).toHaveProperty("error");
    expect(canonicalizeValue(fabric, "")).toEqual({ value: "" });
  });

  it("normalises numbers (dropping their unit) and yes/no answers", () => {
    const length = { key: "saree_length", name: "Saree length", input: "number", unit: "m" };
    expect(canonicalizeValue(length, "6.30 m")).toEqual({ value: "6.3" });
    expect(canonicalizeValue(length, "six")).toHaveProperty("error");
    const lining = { key: "lining", name: "Lining", input: "boolean" };
    expect(canonicalizeValue(lining, "included")).toEqual({ value: "Yes" });
    expect(canonicalizeValue(lining, "no")).toEqual({ value: "No" });
    expect(formatAttributeValues(length, ["6.3"])).toBe("6.3 m");
  });

  it("groups multi-value details for the form", () => {
    const entries = [{ key: "work", value: "Zari" }, { key: "work", value: "Sequins" }, { key: "fabric", value: "Silk" }];
    expect(attributeRecordOf(entries, (key) => key === "work")).toEqual({ work: ["Zari", "Sequins"], fabric: "Silk" });
  });
});

describe("validators", () => {
  it("keeps attribute keys usable as URL parameters", () => {
    expect(attributeKeyFrom("Sleeve length")).toBe("sleeve_length");
    expect(attributeKeyFrom("2-in-1")).toBe("a_2_in_1");
    expect(attributeKeyFrom("Type")).toBe("type_value");
    for (const key of RESERVED_ATTRIBUTE_KEYS) {
      expect(createAttributeSchema.safeParse({ key, name: "X", input: "text" }).success).toBe(false);
    }
    expect(createAttributeSchema.safeParse({ name: "Fit", input: "select", values: [{ label: "Slim" }, { label: "slim" }] }).success).toBe(false);
  });

  it("keeps a type's details and options apart and its size chart on one of its options", () => {
    expect(createProductTypeSchema.safeParse({ name: "Tee", fields: [{ key: "size" }], options: [{ key: "size" }] }).success).toBe(false);
    expect(createProductTypeSchema.safeParse({ name: "Tee", options: [{ key: "color" }, { key: "size" }, { key: "fit" }, { key: "neck" }] }).success).toBe(false);
    const chart = { optionKey: "waist", columns: [{ label: "Waist", primary: true }], rows: [{ size: "30", values: ["30"] }] };
    expect(createProductTypeSchema.safeParse({ name: "Tee", options: [{ key: "size" }], sizeChart: chart }).success).toBe(false);
    expect(createProductTypeSchema.safeParse({ name: "Jeans", options: [{ key: "waist" }], sizeChart: chart }).success).toBe(true);
    expect(sizeChartInputSchema.safeParse({ ...chart, rows: [{ size: "30" }, { size: "30" }] }).success).toBe(false);
    expect(sizeChartInputSchema.safeParse({ ...chart, columns: [{ label: "EU", primary: true, measurement: false }] }).success).toBe(false);
  });

  it("needs a product type and unique variant SKUs", () => {
    const product = { name: "Tee", sku: "TEE", category: "c", price: 1, wholesalePrice: 1 };
    expect(createProductInputSchema.safeParse(product).success).toBe(false);
    const typed = { ...product, productType: "a".repeat(24) };
    expect(createProductInputSchema.safeParse(typed).success).toBe(true);
    const variants = [
      { options: { size: "M" }, sku: "TEE-M", stockQuantity: 1 },
      { options: { size: "L" }, sku: "tee-m", stockQuantity: 1 },
    ];
    expect(createProductInputSchema.safeParse({ ...typed, variants }).success).toBe(false);
  });

  it("names types in the plural for navigation", () => {
    expect(pluralOf("Kurta")).toBe("Kurtas");
    expect(pluralOf("Dress")).toBe("Dresses");
    expect(pluralOf("Accessory")).toBe("Accessories");
    expect(pluralOf("Jeans")).toBe("Jeans");
  });
});

describe("templates", () => {
  it("only use attribute presets that exist, with options shoppers can pick one of", () => {
    for (const template of TYPE_TEMPLATES) {
      for (const [key] of template.fields) expect(ATTRIBUTE_PRESETS[key], `${template.key} detail ${key}`).toBeDefined();
      for (const option of template.options) {
        const preset = ATTRIBUTE_PRESETS[option.key];
        expect(preset, `${template.key} option ${option.key}`).toBeDefined();
        expect(OPTION_INPUTS).toContain(preset.input);
        const labels = (preset.values ?? []).map((value) => (Array.isArray(value) ? value[0] : value));
        for (const value of option.values ?? []) expect(labels, `${template.key} ${option.key} ${value}`).toContain(value);
      }
    }
  });

  it("have size charts on one of their options, one fit-finder measurement and a full grid", () => {
    for (const template of TYPE_TEMPLATES.filter((entry) => entry.sizeChart)) {
      const chart = template.sizeChart;
      expect(template.options.map((option) => option.key)).toContain(chart.optionKey);
      expect(chart.columns.filter((column) => column.primary)).toHaveLength(1);
      for (const row of chart.rows) expect(row.length - 1, `${template.key} ${row[0]}`).toBe(chart.columns.length);
      const parsed = sizeChartInputSchema.safeParse({ ...chart, rows: chart.rows.map(([size, ...values]) => ({ size, values })) });
      expect(parsed.success, template.key).toBe(true);
    }
  });

  it("summarise for the admin picker", () => {
    const tee = typeTemplateSummaries().find((summary) => summary.key === "t-shirt");
    expect(tee).toMatchObject({ pluralName: "T-shirts", options: ["Colour", "Size"], hasSizeChart: true });
  });
});
