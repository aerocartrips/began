"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import ProductImageManager from "@/components/admin/product-image-manager";
import EmptyState from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/api/api-client";
import {
  buildProductApiPayload,
  productImagesArePersistable,
} from "@/features/products/admin-product-api";
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
  const [images, setImages] = useState<Product["images"]>(product?.images ?? []);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await apiRequest<{ name: string }[]>("/api/v1/categories");
      if (response.ok && response.data) {
        setCategories(response.data.map((entry) => entry.name).filter(Boolean));
      }
    })();
  }, []);

  if (product === null) {
    return (
      <EmptyState
        title="Product not found"
        description="This product is no longer available in the catalog."
        action={<Button href="/admin/products">Back to products</Button>}
      />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    if (!title || !sku || !slug) {
      setError("Product name, SKU, and a valid URL slug are required.");
      return;
    }
    if (price === null || minimumOrderQuantity === null || inventory === null || lengthMeters === null) {
      setError("Price, MOQ, inventory, and saree length must be valid positive values.");
      return;
    }
    if (images.length === 0) {
      setError("Add at least one product image.");
      return;
    }
    if (!productImagesArePersistable(images)) {
      setError("Upload all images to Cloudinary before saving the product.");
      return;
    }

    const compareAtPrice = String(data.get("compareAtPrice") ?? "").trim();
    const compareAtPriceCents = compareAtPrice ? Math.round(Number(compareAtPrice) * 100) : undefined;
    if (
      compareAtPriceCents !== undefined &&
      (!Number.isSafeInteger(compareAtPriceCents) ||
        compareAtPriceCents <= Math.round(price * 100))
    ) {
      setError("Compare-at price must be greater than the current selling price.");
      return;
    }

    const nextProduct: Product = {
      id: product?.id ?? "",
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
    try {
      const payload = buildProductApiPayload(nextProduct);
      const response = product
        ? await apiRequest(`/api/v1/products/${encodeURIComponent(product.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await apiRequest("/api/v1/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        const fieldMessage = response.errors?.[0]?.message;
        setError(fieldMessage || response.message || "Could not save this product.");
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Unable to reach the product API. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (product === null) return null;

  const categoryOptions = [...new Set([...categories, product?.category].filter(Boolean))];

  return (
    <>
      <AdminPageHeading
        eyebrow="Saree catalog"
        title={product ? `Edit ${product.title}` : "Add saree product"}
        description="Products are saved to MongoDB through POST/PATCH /api/v1/products."
      />
      <form className="admin-product-form" onSubmit={(event) => void handleSubmit(event)}>
        <section className="admin-form-section">
          <h2>Product details</h2>
          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">
              Product name
              <input name="title" defaultValue={product?.title} maxLength={120} required />
            </label>
            <label className="admin-field">
              SKU
              <input name="sku" defaultValue={product?.sku} maxLength={48} required />
            </label>
            <label className="admin-field">
              URL slug
              <input name="slug" defaultValue={product?.slug} maxLength={120} placeholder="Generated from product name" />
            </label>
            <label className="admin-field">
              Category
              <input name="category" list="product-categories" defaultValue={product?.category} maxLength={80} required />
              <datalist id="product-categories">
                {categoryOptions.map((category) => (
                  <option value={category} key={category} />
                ))}
              </datalist>
            </label>
            <label className="admin-field">
              Weave / origin
              <input name="details" defaultValue={product?.details} maxLength={120} required />
            </label>
            <label className="admin-field admin-field-wide">
              Description
              <textarea name="description" defaultValue={product?.description} rows={4} maxLength={2000} required />
            </label>
          </div>
        </section>

        <section className="admin-form-section">
          <h2>Saree specifications</h2>
          <div className="admin-form-grid">
            <label className="admin-field">
              Fabric
              <input name="fabric" defaultValue={product?.saree.fabric} maxLength={80} required />
            </label>
            <label className="admin-field">
              Weave
              <input name="weave" defaultValue={product?.saree.weave} maxLength={100} required />
            </label>
            <label className="admin-field">
              Primary color
              <input name="color" defaultValue={product?.saree.color} maxLength={80} required />
            </label>
            <label className="admin-field">
              Zari / embellishment
              <input name="embellishment" defaultValue={product?.saree.embellishment} maxLength={120} />
            </label>
            <label className="admin-field">
              Occasion
              <input name="occasion" defaultValue={product?.saree.occasion} maxLength={100} />
            </label>
            <label className="admin-field">
              Length (meters)
              <input
                name="lengthMeters"
                type="number"
                min="1"
                max="20"
                step="0.1"
                defaultValue={product?.saree.lengthMeters ?? 6.3}
                required
              />
            </label>
            <label className="admin-field">
              Wash care
              <input name="washCare" defaultValue={product?.saree.washCare} maxLength={120} />
            </label>
            <label className="admin-checkbox">
              <input name="blousePiece" type="checkbox" defaultChecked={product?.saree.blousePiece ?? true} /> Blouse piece included
            </label>
          </div>
        </section>

        <section className="admin-form-section">
          <h2>Pricing and inventory</h2>
          <div className="admin-form-grid">
            <label className="admin-field">
              Current selling price (USD)
              <input
                name="price"
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                defaultValue={product ? (product.priceCents / 100).toFixed(2) : ""}
                required
              />
            </label>
            <label className="admin-field">
              Compare-at price (USD)
              <input
                name="compareAtPrice"
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                defaultValue={product?.compareAtPriceCents ? (product.compareAtPriceCents / 100).toFixed(2) : ""}
              />
            </label>
            <label className="admin-field">
              Minimum order quantity
              <input
                name="minimumOrderQuantity"
                type="number"
                min="1"
                max="1000000"
                step="1"
                defaultValue={product?.minimumOrderQuantity ?? 1}
                required
              />
            </label>
            <label className="admin-field">
              Inventory units
              <input
                name="inventory"
                type="number"
                min="0"
                max="10000000"
                step="1"
                defaultValue={product?.inventory ?? 0}
                required
              />
            </label>
            <label className="admin-field">
              Listing status
              <select name="status" defaultValue={product?.status ?? "draft"}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label className="admin-checkbox">
              <input name="featured" type="checkbox" defaultChecked={product?.featured ?? false} /> Featured saree
            </label>
          </div>
        </section>

        <section className="admin-form-section">
          <h2>Product images</h2>
          <ProductImageManager
            images={images}
            onChange={setImages}
            fabric={product?.saree.fabric}
            productId={product?.id || undefined}
          />
        </section>

        <section className="admin-form-section">
          <h2>Fulfillment and search</h2>
          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">
              Shipping details
              <textarea name="shippingDetails" defaultValue={product?.shippingDetails} rows={2} maxLength={300} required />
            </label>
            <label className="admin-field">
              SEO title
              <input name="seoTitle" defaultValue={product?.seoTitle} maxLength={120} />
            </label>
            <label className="admin-field">
              SEO description
              <input name="seoDescription" defaultValue={product?.seoDescription} maxLength={160} />
            </label>
          </div>
        </section>

        {error ? (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="admin-form-actions">
          <Button href="/admin/products" variant="secondary">
            Cancel
          </Button>
          <LoadingButton type="submit" loading={pending} loadingText="Saving...">
            {product ? "Save changes" : "Create product"}
          </LoadingButton>
        </div>
      </form>
    </>
  );
}
