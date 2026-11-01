import type { Metadata } from "next";
import ProductDetailClient from "@/components/marketplace/product-detail-client";
import {
  getStorefrontProductBySlug,
  getStorefrontProductSlugs,
} from "@/lib/catalog/storefront-catalog";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getStorefrontProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);
  if (!product) return { title: "Product not found | Norosilk" };
  return {
    title: `${product.title} | Norosilk`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}
