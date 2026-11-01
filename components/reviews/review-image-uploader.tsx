"use client";

import { ImagePlus } from "lucide-react";
import { MAX_REVIEW_IMAGES } from "@/lib/constants/review-status";
import { MAX_UPLOAD_BYTES } from "@/lib/validators/upload.validator";

type ReviewImageUploaderProps = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
};

const MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export default function ReviewImageUploader({ files, onChange, disabled }: ReviewImageUploaderProps) {
  function handleSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    const valid = selected.filter(
      (file) => MIME.has(file.type) && file.size <= MAX_UPLOAD_BYTES,
    );
    const merged = [...files, ...valid].slice(0, MAX_REVIEW_IMAGES);
    onChange(merged);
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="review-uploader">
      <span className="review-uploader-title">
        Photos <small className="review-optional">(optional, up to {MAX_REVIEW_IMAGES})</small>
      </span>
      <label className="review-uploader-drop">
        <ImagePlus size={18} aria-hidden="true" />
        <span>{files.length >= MAX_REVIEW_IMAGES ? "Photo limit reached" : "Add photos"}</span>
        <input
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled || files.length >= MAX_REVIEW_IMAGES}
          onChange={handleSelect}
        />
      </label>
      <p className="review-uploader-hint">JPEG, PNG, or WebP · max 10 MB each</p>
      {files.length ? (
        <ul className="review-uploader-previews">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <span>{file.name}</span>
              <button type="button" onClick={() => removeAt(index)} disabled={disabled}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
