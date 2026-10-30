import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "@/lib/utils/api-error";

let configured = false;

export function assertCloudinaryEnv() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloud_name || !api_key || !api_secret) {
    throw new ApiError(
      503,
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }

  return { cloud_name, api_key, api_secret };
}

export function getCloudinary() {
  const credentials = assertCloudinaryEnv();
  if (!configured) {
    cloudinary.config({
      cloud_name: credentials.cloud_name,
      api_key: credentials.api_key,
      api_secret: credentials.api_secret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

export function getCloudName() {
  return process.env.CLOUDINARY_CLOUD_NAME?.trim() || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || "";
}
