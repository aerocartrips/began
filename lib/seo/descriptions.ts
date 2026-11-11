import type { ProductDetailData } from "@/features/catalog/types";
import type { PublicTenant } from "@/lib/tenant/types";
import { formatNumber, formatRupees } from "@/lib/format";
import { siteNameOf } from "@/lib/seo/metadata";

/**
 * Meta descriptions for pages the store hasn't written one for. Google asks
 * for page-specific, human-readable descriptions, generated from the data on
 * large catalogues, with the facts shoppers compare (price, material, minimum
 * order). Text the store wrote always comes first.
 */

const wholesale = (tenant: PublicTenant) => tenant.salesMode === "wholesale";
const plural = (count: number, one: string, many: string) => `${formatNumber(count)} ${count === 1 ? one : many}`;

/** The store's SEO description or summary, else name, materials, price, minimum order and colours. */
export function productDescription(tenant: PublicTenant, product: ProductDetailData) {
  if (product.seoDescription) return product.seoDescription;
  const spec = (label: string) => product.specs.find((entry) => entry.label === label)?.value;
  const facts = [spec("Fabric"), spec("Weave"), spec("Pattern")].filter(Boolean).join(", ");
  const price = `${formatRupees(product.price)}${wholesale(tenant) ? " per piece" : ""}`;
  const minimum = wholesale(tenant) && product.minimumQuantity > 1 ? ` Minimum order ${formatNumber(product.minimumQuantity)} pieces.` : "";
  const colours = product.variants.length > 1 ? ` Available in ${formatNumber(product.variants.length)} colours.` : "";
  return `${product.name}${facts ? ` – ${facts}` : ""}. ${price}.${minimum}${colours} Buy online from ${siteNameOf(tenant)}.`;
}

/** /products; the count only for the plain catalogue (a filtered view's count says nothing useful). */
export function catalogueDescription(tenant: PublicTenant, total: number | null) {
  const sarees = total === null ? "sarees" : plural(total, "saree", "sarees");
  return wholesale(tenant)
    ? `Buy ${sarees} wholesale from ${siteNameOf(tenant)}, with per-piece prices and minimum order quantities on every product.`
    : `Shop ${sarees} online from ${siteNameOf(tenant)}.`;
}

/** /categories/[slug]: the store's category description, else a summary of what it lists (counted when plain). */
export function categoryDescription(tenant: PublicTenant, category: { name: string; description: string }, total: number | null) {
  if (category.description) return category.description;
  // Category names usually say what they are ("Linen Sarees"); otherwise say it.
  const subject = /saree|sari/i.test(category.name) ? category.name : `${category.name} sarees`;
  const designs = total === null ? subject : `${plural(total, "design", "designs")} of ${subject}`;
  return wholesale(tenant)
    ? `Buy ${designs} wholesale from ${siteNameOf(tenant)}, with per-piece prices and minimum order quantities.`
    : `Shop ${designs} online from ${siteNameOf(tenant)}.`;
}
