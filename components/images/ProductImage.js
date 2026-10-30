"use client";

import { useState } from "react";
import Image from "next/image";
import { buildClientDeliveryUrl } from "@/lib/cloudinary/transformations";
import ImageSkeleton from "@/components/ui/loaders/ImageSkeleton";

/**
 * @param {{
 *   image: { src?: string, url?: string, secureUrl?: string, publicId?: string, alt?: string, width?: number, height?: number },
 *   preset?: "thumbnail"|"productCard"|"productDetail"|"highResolution",
 *   priority?: boolean,
 *   sizes?: string,
 *   className?: string,
 *   fill?: boolean,
 *   width?: number,
 *   height?: number,
 * }} props
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
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const transformed = image.publicId ? buildClientDeliveryUrl(image.publicId, preset) : null;
  const src = transformed || image.secureUrl || image.src || image.url;

  if (!src) return null;

  if (failed) {
    return (
      <div className="ui-image-frame is-error" aria-label={image.alt || "Image unavailable"}>
        Image unavailable
      </div>
    );
  }

  const frameClass = ["ui-image-frame", loaded ? "is-loaded" : ""].filter(Boolean).join(" ");

  if (fill) {
    return (
      <div className={frameClass}>
        {!loaded ? <ImageSkeleton /> : null}
        <Image
          src={src}
          alt={image.alt || "Product image"}
          fill
          priority={priority}
          sizes={sizes}
          className={className}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      {!loaded ? <ImageSkeleton className="ui-image-skeleton--fixed" /> : null}
      <Image
        src={src}
        alt={image.alt || "Product image"}
        width={width || image.width || 600}
        height={height || image.height || 800}
        priority={priority}
        sizes={sizes}
        className={className}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
