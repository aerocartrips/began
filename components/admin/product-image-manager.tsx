"use client";

import { useState } from "react";
import ImageUploader from "@/components/images/image-uploader";
import type { ProductImage } from "@/features/products/types/product";

type ProductImageManagerProps = {
  images: readonly ProductImage[];
  onChange: (images: ProductImage[]) => void;
  productId?: string;
  fabric?: string;
};

const cloudinaryEnabled = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

export default function ProductImageManager({
  images,
  onChange,
  productId,
  fabric,
}: ProductImageManagerProps) {
  const [localImages, setLocalImages] = useState<ProductImage[]>(() => [...images]);

  if (cloudinaryEnabled) {
    return (
      <ImageUploader
        images={localImages}
        onChange={(next) => {
          setLocalImages(next);
          onChange(next);
        }}
        productId={productId}
        fabric={fabric}
      />
    );
  }

  return (
    <p className="admin-image-disclaimer">
      Cloudinary is not configured. Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and server credentials to enable secure uploads.
    </p>
  );
}
