"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { ImagePlus, Star, Trash2, UploadCloud } from "lucide-react";
import ImagePreview from "@/components/images/ImagePreview";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/LoadingButton";

/**
 * @typedef {Object} ManagedImage
 * @property {string} src
 * @property {string} [secureUrl]
 * @property {string} [publicId]
 * @property {string} alt
 * @property {boolean} [isPrimary]
 * @property {number} [sortOrder]
 * @property {boolean} [pendingUpload]
 * @property {File} [file]
 */

const cloudinaryEnabled = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

/**
 * @param {{
 *   images: ManagedImage[],
 *   onChange: (images: ManagedImage[]) => void,
 *   productId?: string,
 *   folder?: string,
 *   fabric?: string,
 *   maxImages?: number,
 * }} props
 */
export default function ImageUploader({
  images,
  onChange,
  productId,
  folder,
  fabric,
  maxImages = 8,
}) {
  const inputId = useId();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState(/** @type {File[]} */ ([]));

  const stagedCount = useMemo(
    () => images.filter((image) => image.pendingUpload).length + selectedFiles.length,
    [images, selectedFiles],
  );

  const validateFiles = useCallback(
    (files) => {
      const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
      const picked = Array.from(files);
      if (!picked.length) return { ok: false, message: "Select at least one image." };
      if (images.length + picked.length > maxImages) {
        return { ok: false, message: `You can manage up to ${maxImages} images per product.` };
      }
      for (const file of picked) {
        if (!allowed.has(file.type)) {
          return { ok: false, message: `${file.name} must be JPG, PNG, or WebP.` };
        }
        if (file.size > 10 * 1024 * 1024) {
          return { ok: false, message: `${file.name} exceeds the 10 MB limit.` };
        }
      }
      return { ok: true, files: picked };
    },
    [images.length, maxImages],
  );

  function stageFiles(fileList) {
    const validation = validateFiles(fileList);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setError("");
    setSelectedFiles((current) => [...current, ...validation.files]);
  }

  async function uploadSelected() {
    if (!cloudinaryEnabled) {
      setError("Cloudinary is not configured for uploads.");
      return;
    }
    if (!selectedFiles.length) {
      setError("Select images first, then upload.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      if (folder) formData.append("folder", folder);
      if (fabric) formData.append("fabric", fabric);

      const endpoint = productId
        ? `/api/v1/products/${productId}/images`
        : "/api/v1/upload";

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload.message ?? "Upload failed.");
        return;
      }

      const uploaded = productId ? payload.data.uploaded : payload.data.images;
      const mapped = (uploaded || []).map((image, index) => ({
        src: image.secureUrl || image.url,
        secureUrl: image.secureUrl || image.url,
        publicId: image.publicId,
        alt: image.alt || "",
        isPrimary: images.length === 0 && index === 0,
        sortOrder: images.length + index,
      }));

      onChange([...images, ...mapped]);
      setSelectedFiles([]);
      if (payload.data.failures?.length) {
        setError("Some files failed to upload. Review the remaining selections and try again.");
      }
    } catch {
      setError("Unable to reach the upload service.");
    } finally {
      setPending(false);
    }
  }

  function setPrimary(index) {
    onChange(images.map((image, imageIndex) => ({ ...image, isPrimary: imageIndex === index })));
  }

  function removeImage(index) {
    onChange(images.filter((_, imageIndex) => imageIndex !== index));
  }

  function moveImage(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((image, imageIndex) => ({ ...image, sortOrder: imageIndex })));
  }

  return (
    <div className="admin-image-manager">
      <div
        className={`admin-image-dropzone${dragActive ? " is-active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          stageFiles(event.dataTransfer.files);
        }}
      >
        <label className="admin-image-picker" htmlFor={inputId}>
          <ImagePlus size={18} aria-hidden="true" />
          <span>{pending ? "Uploading..." : "Drag and drop saree images"}</span>
          <small>JPG, PNG, WebP · Up to 10 MB · Upload on save action</small>
        </label>
        <input
          className="sr-only"
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={pending}
          onChange={(event) => {
            stageFiles(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
      </div>

      {selectedFiles.length > 0 && (
        <div className="admin-image-staged">
          <p>{selectedFiles.length} selected file(s) ready to upload.</p>
          <LoadingButton type="button" loading={pending} loadingText="Uploading..." onClick={uploadSelected} icon={<UploadCloud size={15} />}>
            Upload selected images
          </LoadingButton>
        </div>
      )}

      <p className="admin-image-disclaimer">
        Images upload to Cloudinary only when you click upload. Staged files stay local until then.
        {stagedCount > 0 ? ` ${stagedCount} pending.` : ""}
      </p>
      {error && <p className="admin-form-error" role="alert">{error}</p>}

      {images.length > 0 && (
        <ol className="admin-image-grid" aria-label="Product image order">
          {images.map((image, index) => (
            <li className="admin-image-item" key={image.publicId || image.src || index}>
              <ImagePreview image={image} label={image.isPrimary || index === 0 ? "Primary" : `Image ${index + 1}`} />
              <input
                aria-label={`Image ${index + 1} alt text`}
                value={image.alt}
                onChange={(event) =>
                  onChange(
                    images.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, alt: event.currentTarget.value } : item,
                    ),
                  )
                }
                placeholder="Accessible image description"
              />
              <div className="admin-image-actions">
                <button type="button" aria-label="Set as primary image" onClick={() => setPrimary(index)}>
                  <Star size={14} />
                </button>
                <button type="button" aria-label="Move image earlier" disabled={index === 0} onClick={() => moveImage(index, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move image later"
                  disabled={index === images.length - 1}
                  onClick={() => moveImage(index, 1)}
                >
                  ↓
                </button>
                <button type="button" aria-label="Remove image" onClick={() => removeImage(index)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
