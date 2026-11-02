import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RequestQuoteClient, { type QuoteLine } from "@/features/quotes/request-quote-client";
import { getProductDetail } from "@/lib/catalog/query";
import { getCurrentAccountUser } from "@/lib/auth/current-customer";
import { getCurrentTenant } from "@/lib/tenant/current";

export const metadata: Metadata = {
  title: "Request a quote",
  description: "Request wholesale pricing for the products and quantities you need.",
};

type RequestQuotePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function RequestQuotePage({ searchParams }: RequestQuotePageProps) {
  const [tenant, params] = await Promise.all([getCurrentTenant(), searchParams]);
  if (tenant.salesMode !== "wholesale") notFound();

  const initialLines: QuoteLine[] = [];
  const slug = first(params.product);
  if (slug) {
    const product = await getProductDetail(tenant.id, tenant.salesMode, slug);
    if (product) {
      const variant = product.variants.find((entry) => entry.id === first(params.variant)) ?? null;
      initialLines.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        name: product.name,
        colorName: variant?.colorName ?? "",
        imageUrl: (variant?.images[0] ?? product.images[0])?.url ?? "",
        minimumQuantity: product.minimumQuantity,
        listUnitPrice: product.price,
        quantity: Math.max(product.minimumQuantity, Number.parseInt(first(params.quantity), 10) || product.minimumQuantity),
      });
    }
  }

  const user = await getCurrentAccountUser();
  return <RequestQuoteClient initialLines={initialLines} fromCart={first(params.from) === "cart"} signedIn={Boolean(user)} />;
}
