"use client";

import ProductImage from "@/components/images/product-image";
import type { Product } from "@/features/products/types/product";

export default function ProductGallery({ product }: { product: Product }) {
  return (
    <div className="product-gallery" aria-label={`${product.title} images`}>
      {product.images.map((image, index) => (
        <div className="product-gallery-image" key={image.publicId || image.src || `${index}`}>
          <ProductImage
            image={image}
            preset={index === 0 ? "highResolution" : "productDetail"}
            priority={index === 0}
            sizes="(max-width: 760px) 100vw, 55vw"
          />
        </div>
      ))}
    </div>
  );
}
