import type { CatalogConfig, ProductDetailData } from "@/features/catalog/types";
import type { PublicTenant } from "@/lib/tenant/types";
import { formatNumber, formatRupees } from "@/lib/format";
import { siteNameOf } from "@/lib/seo/metadata";

/**
 * Meta descriptions for pages the store hasn't written one for. Google asks
 * for page-specific, human-readable descriptions, generated from the data on
 * large catalogues, with the facts shoppers compare (price, material, minimum
 * order). Text the store wrote always comes first. What the store sells comes
 * from its product types ("sarees", "T-shirts and jeans"), never a fixed word.
 */

const wholesale = (tenant: PublicTenant) => tenant.salesMode === "wholesale";
const plural = (count: number, one: string, many: string) => `${formatNumber(count)} ${count === 1 ? one : many}`;

/** "Sarees" → "sarees" mid-sentence; "T-shirts" keeps its capital (the second character says it is a code). */
export function inSentence(word: string) {
  const second = word.charAt(1);
  if (second === "-" || (second && second !== second.toLowerCase())) return word;
  return word.charAt(0).toLowerCase() + word.slice(1);
}

/** "sarees", "sarees and T-shirts", "sarees, T-shirts and jeans". */
function listOf(words: string[]) {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** What the store sells, as a sentence's subject: one type by name, up to three listed, else "products". */
export type CatalogueSubject = { one: string; many: string; list: string };

export function catalogueSubject(config: Pick<CatalogConfig, "types"> | null): CatalogueSubject {
  const types = (config?.types ?? []).filter((type) => type.productCount > 0);
  if (types.length === 1) return { one: inSentence(types[0].name), many: inSentence(types[0].pluralName), list: inSentence(types[0].pluralName) };
  const list = types.length > 1 && types.length <= 3 ? listOf(types.map((type) => inSentence(type.pluralName))) : "products";
  return { one: "product", many: "products", list };
}

/** The store's SEO description or summary, else name, details, price, minimum order, colours and sizes. */
export function productDescription(tenant: PublicTenant, product: ProductDetailData) {
  if (product.seoDescription) return product.seoDescription;
  const facts = product.specs
    .slice(0, 3)
    .map((spec) => spec.value)
    .filter((value) => value.length <= 40)
    .join(", ");
  const price = `${formatRupees(product.price)}${wholesale(tenant) ? " per piece" : ""}`;
  const minimum = wholesale(tenant) && product.minimumQuantity > 1 ? ` Minimum order ${formatNumber(product.minimumQuantity)} pieces.` : "";
  const colours = product.options.find((option) => option.kind === "color")?.values.length ?? 0;
  const colourText = colours > 1 ? ` Available in ${formatNumber(colours)} colours.` : "";
  const sizeText = product.sizeRange ? ` Sizes ${product.sizeRange}.` : "";
  return `${product.name}${facts ? ` – ${facts}` : ""}. ${price}.${minimum}${colourText}${sizeText} Buy online from ${siteNameOf(tenant)}.`;
}

/** /products; the count only for the plain catalogue (a filtered view's count says nothing useful). */
export function catalogueDescription(tenant: PublicTenant, total: number | null, subject: CatalogueSubject = catalogueSubject(null)) {
  // One type (or "products") takes the count in front; a list of types takes it after the store's name.
  const several = subject.list !== subject.many;
  const what = total === null || several ? subject.list : plural(total, subject.one, subject.many);
  const count = several && total !== null ? ` (${plural(total, "product", "products")})` : "";
  return wholesale(tenant)
    ? `Buy ${what} wholesale from ${siteNameOf(tenant)}${count}, with per-piece prices and minimum order quantities on every product.`
    : `Shop ${what} online from ${siteNameOf(tenant)}${count}.`;
}

/** /shop/[type]: one product type's listing. */
export function typeDescription(tenant: PublicTenant, type: { name: string; pluralName: string; description: string }, total: number | null) {
  if (type.description) return type.description;
  const what = total === null ? inSentence(type.pluralName) : plural(total, inSentence(type.name), inSentence(type.pluralName));
  return wholesale(tenant)
    ? `Buy ${what} wholesale from ${siteNameOf(tenant)}, with per-piece prices and minimum order quantities.`
    : `Shop ${what} online from ${siteNameOf(tenant)}.`;
}

/** /categories/[slug]: the store's category description, else a summary of what it lists (counted when plain). */
export function categoryDescription(
  tenant: PublicTenant,
  category: { name: string; description: string },
  total: number | null,
  subject: CatalogueSubject = catalogueSubject(null),
) {
  if (category.description) return category.description;
  // Category names usually say what they are ("Linen Sarees"); a single-type store says it otherwise.
  const named = subject.many === "products" || category.name.toLowerCase().includes(subject.one.toLowerCase().replace(/s$/, ""));
  const name = named ? category.name : `${category.name} ${subject.many}`;
  const designs = total === null ? name : `${plural(total, "design", "designs")} of ${name}`;
  return wholesale(tenant)
    ? `Buy ${designs} wholesale from ${siteNameOf(tenant)}, with per-piece prices and minimum order quantities.`
    : `Shop ${designs} online from ${siteNameOf(tenant)}.`;
}
