"use client";

import ProductImage from "@/components/images/ProductImage";

/**
 * @param {{ image: { src?: string, alt?: string, publicId?: string }, label?: string }} props
 */
export default function ImagePreview({ image, label = "Selected image" }) {
  return (
    <div className="admin-image-preview">
      <ProductImage image={image} preset="thumbnail" sizes="160px" />
      <span className="admin-image-cover">{label}</span>
    </div>
  );
}
