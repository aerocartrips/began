"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import ProductImageManager from "@/components/admin/product-image-manager";
import EmptyState from "@/components/ui/empty-state";
import { useProductCatalog } from "@/features/products/product-catalog-provider";
import type { Product } from "@/features/products/types/product";

type ProductFormProps = {
  product?: Product;
};

function makeSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function requiredText(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function positiveNumber(data: FormData, key: string) {
  const value = Number(data.get(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegativeInteger(data: FormData, key: string) {
  const value = Number(data.get(key));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export default function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const { products, createProduct, updateProduct } = useProductCatalog();
  const [images, setImages] = useState<Product["images"]>(product?.images ?? []);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (product === null) {
    return (
      <EmptyState
        title="Product not found"
        description="It may have been removed from this temporary catalog session."
        action={<Button href="/admin/products">Back to products</Button>}
      />
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");

    const data = new FormData(event.currentTarget);
    const title = requiredText(data, "title");
    const sku = requiredText(data, "sku").toUpperCase();
    const slug = makeSlug(requiredText(data, "slug") || title);
    const price = positiveNumber(data, "price");
    const minimumOrderQuantity = positiveNumber(data, "minimumOrderQuantity");
    const inventory = nonNegativeInteger(data, "inventory");
    const lengthMeters = positiveNumber(data, "lengthMeters");

    if (!title || !sku || !slug) return setError("Product name, SKU, and a valid URL slug are required.");
    if (price === null || minimumOrderQuantity === null || inventory === null || lengthMeters === null) {
      return setError("Price, MOQ, inventory, and saree length must be valid positive values.");
    }
    if (images.length === 0) return setError("Add at least one product image preview.");

    const compareAtPrice = String(data.get("compareAtPrice") ?? "").trim();
    const compareAtPriceCents = compareAtPrice ? Math.round(Number(compareAtPrice) * 100) : undefined;
    if (compareAtPriceCents !== undefined && (!Number.isSafeInteger(compareAtPriceCents) || compareAtPriceCents <= Math.round(price * 100))) {
      return setError("Compare-at price must be greater than the current selling price.");
    }

    const nextProduct: Product = {
      id: product?.id ?? `neov-${makeSlug(sku)}`,
      slug,
      sku,
      title,
      details: requiredText(data, "details"),
      description: requiredText(data, "description"),
      category: requiredText(data, "category"),
      currency: "USD",
      priceCents: Math.round(price * 100),
      compareAtPriceCents,
      minimumOrderQuantity,
      inventory,
      status: data.get("status") === "published" ? "published" : "draft",
      featured: data.get("featured") === "on",
      seoTitle: requiredText(data, "seoTitle") || title,
      seoDescription: requiredText(data, "seoDescription") || requiredText(data, "description").slice(0, 160),
      saree: {
        fabric: requiredText(data, "fabric"),
        weave: requiredText(data, "weave"),
        color: requiredText(data, "color"),
        embellishment: requiredText(data, "embellishment"),
        occasion: requiredText(data, "occasion"),
        lengthMeters,
        blousePiece: data.get("blousePiece") === "on",
        washCare: requiredText(data, "washCare"),
      },
      images: [...images],
      shippingDetails: requiredText(data, "shippingDetails"),
      options: product?.options ?? [],
    };

    setPending(true);
    const result = product
      ? updateProduct(product.id, nextProduct)
      : createProduct(nextProduct);
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    router.push("/admin/products");
  }

  if (product === null) return null;

  const categories = [...new Set(products.map((item) => item.category))];
  return (
    <>
      <AdminPageHeading
        eyebrow="Saree catalog"
        title={product ? `Edit ${product.title}` : "Add saree product"}
        description="Changes are held in browser memory for this UI test and reset when the page is refreshed."
      />
      <form className="admin-product-form" onSubmit={handleSubmit}>
        <section className="admin-form-section">
          <h2>Product details</h2>
          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">Product name<input name="title" defaultValue={product?.title} maxLength={120} required /></label>
            <label className="admin-field">SKU<input name="sku" defaultValue={product?.sku} maxLength={48} required /></label>
            <label className="admin-field">URL slug<input name="slug" defaultValue={product?.slug} maxLength={120} placeholder="Generated from product name" /></label>
            <label className="admin-field">Category<input name="category" list="product-categories" defaultValue={product?.category} maxLength={80} required /><datalist id="product-categories">{categories.map((category) => <option value={category} key={category} />)}</datalist></label>
            <label className="admin-field">Weave / origin<input name="details" defaultValue={product?.details} maxLength={120} required /></label>
            <label className="admin-field admin-field-wide">Description<textarea name="description" defaultValue={product?.description} rows={4} maxLength={2000} required /></label>
          </div>
        </section>

        <section className="admin-form-section">
          <h2>Saree specifications</h2>
          <div className="admin-form-grid">
            <label className="admin-field">Fabric<input name="fabric" defaultValue={product?.saree.fabric} maxLength={80} required /></label>
            <label className="admin-field">Weave<input name="weave" defaultValue={product?.saree.weave} maxLength={100} required /></label>
            <label className="admin-field">Primary color<input name="color" defaultValue={product?.saree.color} maxLength={80} required /></label>
            <label className="admin-field">Zari / embellishment<input name="embellishment" defaultValue={product?.saree.embellishment} maxLength={120} /></label>
            <label className="admin-field">Occasion<input name="occasion" defaultValue={product?.saree.occasion} maxLength={100} /></label>
            <label className="admin-field">Length (meters)<input name="lengthMeters" type="number" min="1" max="20" step="0.1" defaultValue={product?.saree.lengthMeters ?? 6.3} required /></label>
            <label className="admin-field">Wash care<input name="washCare" defaultValue={product?.saree.washCare} maxLength={120} /></label>
            <label className="admin-checkbox"><input name="blousePiece" type="checkbox" defaultChecked={product?.saree.blousePiece ?? true} /> Blouse piece included</label>
          </div>
        </section>

        <section className="admin-form-section">
          <h2>Pricing and inventory</h2>
          <div className="admin-form-grid">
            <label className="admin-field">Current selling price (USD)<input name="price" type="number" min="0.01" max="1000000" step="0.01" defaultValue={product ? (product.priceCents / 100).toFixed(2) : ""} required /></label>
            <label className="admin-field">Compare-at price (USD)<input name="compareAtPrice" type="number" min="0.01" max="1000000" step="0.01" defaultValue={product?.compareAtPriceCents ? (product.compareAtPriceCents / 100).toFixed(2) : ""} /></label>
            <label className="admin-field">Minimum order quantity<input name="minimumOrderQuantity" type="number" min="1" max="1000000" step="1" defaultValue={product?.minimumOrderQuantity ?? 1} required /></label>
            <label className="admin-field">Inventory units<input name="inventory" type="number" min="0" max="10000000" step="1" defaultValue={product?.inventory ?? 0} required /></label>
            <label className="admin-field">Listing status<select name="status" defaultValue={product?.status ?? "draft"}><option value="draft">Draft</option><option value="published">Published</option></select></label>
            <label className="admin-checkbox"><input name="featured" type="checkbox" defaultChecked={product?.featured ?? false} /> Featured saree</label>
          </div>
        </section>

        <section className="admin-form-section">
          <h2>Product images</h2>
          <ProductImageManager images={images} onChange={setImages} fabric={product?.saree.fabric} productId={product?.id} />
        </section>

        <section className="admin-form-section">
          <h2>Fulfillment and search</h2>
          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">Shipping details<textarea name="shippingDetails" defaultValue={product?.shippingDetails} rows={2} maxLength={300} required /></label>
            <label className="admin-field">SEO title<input name="seoTitle" defaultValue={product?.seoTitle} maxLength={120} /></label>
            <label className="admin-field">SEO description<input name="seoDescription" defaultValue={product?.seoDescription} maxLength={160} /></label>
          </div>
        </section>

        {error && <p className="admin-form-error" role="alert">{error}</p>}
        <div className="admin-form-actions">
          <Button href="/admin/products" variant="secondary">Cancel</Button>
          <LoadingButton type="submit" loading={pending} loadingText="Saving...">
            {product ? "Save changes" : "Create product"}
          </LoadingButton>
        </div>
      </form>
    </>
  );
}