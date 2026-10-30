import ProductListClient from "@/components/marketplace/product-list-client";
import SectionHeading from "@/components/ui/section-heading";

export const metadata = {
  title: "Saree Catalog | NeoVastra",
  description: "Browse export-ready saree collections from NeoVastra.",
};

export default function ProductsPage() {
  return (
    <main className="catalog-page content-width">
      <SectionHeading
        title="Wholesale Saree Catalog"
        subtitle="Verified batches · Direct weaver sourcing"
      />
      <ProductListClient />
    </main>
  );
}