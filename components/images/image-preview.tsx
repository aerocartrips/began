"use client";

import ProductImage, { type ProductImageSource } from "@/components/images/product-image";

type ImagePreviewProps = {
  image: ProductImageSource;
  label?: string;
};

export default function ImagePreview({ image, label = "Selected image" }: ImagePreviewProps) {
  return (
    <div className="admin-image-preview">
      <ProductImage image={image} preset="thumbnail" sizes="160px" />
      <span className="admin-image-cover">{label}</span>
    </div>
  );
}
