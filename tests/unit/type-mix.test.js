import { describe, expect, it } from "vitest";
import { dominantType, groupByType, interleave } from "@/lib/catalog/type-mix";
import { decodeMixCursor, encodeMixCursor } from "@/lib/catalog/cursor";
import { defaultHomeSections, localizeHomeCopy, normalizeHomeSections } from "@/lib/content/homepage-defaults";
import { inSentence } from "@/lib/catalog/words";

const id = (n) => n.toString(16).padStart(24, "0");

describe("taking turns between product types", () => {
  it("takes one from each type per round, keeping each type's own order", () => {
    const sarees = ["s1", "s2", "s3", "s4"];
    const tees = ["t1", "t2"];
    const jeans = ["j1"];
    expect(interleave([sarees, tees, jeans])).toEqual(["s1", "t1", "j1", "s2", "t2", "s3", "s4"]);
    expect(interleave([sarees, tees, jeans], 4)).toEqual(["s1", "t1", "j1", "s2"]);
    expect(interleave([[], tees])).toEqual(["t1", "t2"]);
    expect(interleave([])).toEqual([]);
  });

  it("puts a category under the type 80% of its products are, else under Collections", () => {
    expect(dominantType(new Map([[id(1), 9], [id(2), 1]]))).toBe(id(1));
    expect(dominantType(new Map([[id(1), 7], [id(2), 3]]))).toBeNull();
    // Products without a type count against the share.
    expect(dominantType(new Map([[id(1), 8], ["", 2]]))).toBe(id(1));
    expect(dominantType(new Map([["", 5]]))).toBeNull();
    expect(dominantType(new Map())).toBeNull();
  });

  it("groups categories under the types in the store's order, then Collections", () => {
    const types = [{ id: id(1) }, { id: id(2) }, { id: id(3) }];
    const categories = [
      { name: "Denim", typeId: id(2) },
      { name: "Banarasi", typeId: id(1) },
      { name: "Festive", typeId: null },
      { name: "Kanjivaram", typeId: id(1) },
      { name: "Old type", typeId: id(9) },
    ];
    const groups = groupByType(categories, types);
    expect(groups.map((group) => [group.typeId, group.items.map((item) => item.name)])).toEqual([
      [id(1), ["Banarasi", "Kanjivaram"]],
      [id(2), ["Denim"]],
      [null, ["Festive", "Old type"]],
    ]);
  });
});

describe("the feed cursor that keeps a place per type", () => {
  it("round-trips positions and exhausted types", () => {
    const positions = { [id(1)]: { score: 12.5, id: id(10) }, [id(2)]: 0, none: { score: 0, id: id(11) } };
    expect(decodeMixCursor(encodeMixCursor(positions))).toEqual(positions);
  });

  it("starts over on anything it can't trust", () => {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    for (const cursor of [null, "", "%%%", encode({ m: [] }), encode({ m: { "not-an-id": 0 } }), encode({ m: { [id(1)]: [-1, id(2)] } }), encode({ m: { [id(1)]: [1, "x"] } }), "a".repeat(5000)]) {
      expect(decodeMixCursor(cursor)).toBeNull();
    }
  });
});

describe("home sections a saved layout predates", () => {
  it("adds Shop by type right after Picked for you", () => {
    const saved = defaultHomeSections().filter((section) => section.type !== "shop-by-type");
    const types = normalizeHomeSections(saved).map((section) => section.type);
    expect(types.slice(types.indexOf("for-you"), types.indexOf("for-you") + 2)).toEqual(["for-you", "shop-by-type"]);
    // Where the admin moved "Picked for you", Shop by type follows it there.
    const moved = [...saved.filter((section) => section.type !== "for-you"), saved.find((section) => section.type === "for-you")];
    expect(normalizeHomeSections(moved).map((section) => section.type).slice(-2)).toEqual(["for-you", "shop-by-type"]);
  });
});

describe("copy that names what the store sells", () => {
  const byKey = (sections) => Object.fromEntries(sections.map((section) => [section.key, section]));

  it("names the one type a store sells", () => {
    const sections = byKey(localizeHomeCopy(defaultHomeSections(), [{ name: "T-shirt", pluralName: "T-shirts" }]));
    expect(sections.feed.title).toBe("All T-shirts");
    expect(sections["quick-picks"].title).toBe("Find your T-shirt faster");
    const sarees = byKey(localizeHomeCopy(defaultHomeSections(), [{ name: "Saree", pluralName: "Sarees" }]));
    expect(sarees.feed.title).toBe("All sarees");
  });

  it("keeps generic copy for several types and never replaces the admin's own", () => {
    const custom = defaultHomeSections().map((section) => (section.key === "feed" ? { ...section, title: "Our full range" } : section));
    const several = byKey(localizeHomeCopy(custom, [{ name: "Saree", pluralName: "Sarees" }, { name: "Shirt", pluralName: "Shirts" }]));
    expect(several.feed.title).toBe("Our full range");
    expect(several["quick-picks"].title).toBe("Find it faster");
    const one = byKey(localizeHomeCopy(custom, [{ name: "Shirt", pluralName: "Shirts" }]));
    expect(one.feed.title).toBe("Our full range");
  });

  it("reads type names mid-sentence", () => {
    expect(inSentence("Sarees")).toBe("sarees");
    expect(inSentence("T-shirts")).toBe("T-shirts");
    expect(inSentence("Kurtas & kurtis")).toBe("kurtas & kurtis");
  });
});

describe("hero slides that lead to nothing on sale", () => {
  it("leaves out slides whose button opens an empty category or a type that isn't sold", async () => {
    const { leadsToProducts } = await import("@/lib/content/banner-links");
    const categories = new Set(["banarasi-silk", "denim"]);
    const types = new Set(["sarees", "jeans"]);
    expect(leadsToProducts("/categories/banarasi-silk", categories, types)).toBe(true);
    expect(leadsToProducts("/categories/Banarasi-Silk/?utm=x", categories, types)).toBe(true);
    expect(leadsToProducts("/categories/kota-doria", categories, types)).toBe(false);
    expect(leadsToProducts("/shop/t-shirts", categories, types)).toBe(false);
    expect(leadsToProducts("/shop/jeans#top", categories, types)).toBe(true);
    // Anything else, unknown data or a malformed link keeps the slide.
    expect(leadsToProducts("/request-quote", categories, types)).toBe(true);
    expect(leadsToProducts("https://example.com/categories/x", categories, types)).toBe(true);
    expect(leadsToProducts("/categories/kota-doria", null, types)).toBe(true);
    expect(leadsToProducts("/categories/%E0%A4", categories, types)).toBe(false);
    expect(() => leadsToProducts("/categories/%E0%A4", categories, types)).not.toThrow();
  });
});

describe("saree wording kept from older layouts", () => {
  const legacy = defaultHomeSections().map((section) =>
    section.key === "feed"
      ? { ...section, title: "All sarees" }
      : section.key === "newsletter"
        ? { ...section, description: "Be first to see new weaves, restocks and offers." }
        : section,
  );
  const byKey = (sections) => Object.fromEntries(sections.map((section) => [section.key, section]));

  it("stays in a store that sells sarees alone, and goes everywhere else", () => {
    const sarees = byKey(localizeHomeCopy(legacy, [{ name: "Saree", pluralName: "Sarees", template: "saree" }]));
    expect(sarees.feed.title).toBe("All sarees");
    expect(sarees.newsletter.description).toBe("Be first to see new weaves, restocks and offers.");

    const tees = byKey(localizeHomeCopy(legacy, [{ name: "T-shirt", pluralName: "T-shirts", template: "t-shirt" }]));
    expect(tees.feed.title).toBe("All T-shirts");
    expect(tees.newsletter.description).toBe("Be first to see new arrivals, restocks and offers.");

    // A store from before product types is a saree store.
    expect(byKey(localizeHomeCopy(legacy, [])).newsletter.description).toBe("Be first to see new weaves, restocks and offers.");
  });
});
