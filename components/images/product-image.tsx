"use client";

import { useState } from "react";
import Image from "next/image";
import { CLOUDINARY_LOADERS } from "@/lib/cloudinary/transformations";
import ImageSkeleton from "@/components/ui/loaders/image-skeleton";

export type ProductImageSource = {
  src?: string;
  url?: string;
  secureUrl?: string;
  publicId?: string;
  alt?: string;
  width?: number;
  height?: number;
};

export type ImagePreset = "thumbnail" | "productCard" | "productDetail" | "highResolution";

type ProductImageProps = {
  image: ProductImageSource;
  preset?: ImagePreset;
  /** Above the fold (first cards, first gallery photo): load now, ahead of other images. */
  priority?: boolean;
  sizes?: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
};

const HAS_CLOUDINARY = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim());

/**
 * A catalogue photo with a loading skeleton and an error state. Cloudinary
 * assets are resized by Cloudinary's CDN for every srcset width (the Next
 * server does no image work); other URLs go through the Next optimizer.
 */
export default function ProductImage({
  image,
  preset = "productCard",
  priority = false,
  sizes = "(max-width: 760px) 100vw, 33vw",
  className = "cover-image",
  fill = true,
  width,
  height,
}: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const cloudinary = HAS_CLOUDINARY && Boolean(image.publicId);
  const src = cloudinary ? image.publicId : image.secureUrl || image.src || image.url;

  if (!src) return null;

  if (failed) {
    return (
      <div className="ui-image-frame is-error" aria-label={image.alt || "Image unavailable"}>
        Image unavailable
      </div>
    );
  }

  const alt = image.alt || "Product image";
  // `priority` is deprecated in Next 16; eager + high fetch priority is the documented replacement.
  const common = {
    src,
    loader: cloudinary ? CLOUDINARY_LOADERS[preset] : undefined,
    sizes,
    className,
    ...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {}),
    onLoad: () => setLoaded(true),
    onError: () => setFailed(true),
  };

  return (
    <div className={["ui-image-frame", loaded ? "is-loaded" : ""].filter(Boolean).join(" ")}>
      {!loaded ? <ImageSkeleton className={fill ? undefined : "ui-image-skeleton--fixed"} /> : null}
      {fill ? (
        <Image {...common} alt={alt} fill />
      ) : (
        <Image {...common} alt={alt} width={width || image.width || 600} height={height || image.height || 800} />
      )}
    </div>
  );
}
