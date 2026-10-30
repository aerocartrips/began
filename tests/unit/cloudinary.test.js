import { describe, expect, it } from "vitest";
import {
  TRANSFORMATION_PRESETS,
  buildDeliveryUrl,
} from "@/lib/cloudinary/transformations";
import {
  ALLOWED_UPLOAD_FOLDERS,
  isManagedCloudinaryPublicId,
  resolveUploadFolder,
} from "@/lib/constants/cloudinary-folders";
import { validateUploadFile } from "@/lib/validators/upload.validator";

describe("cloudinary transformations", () => {
  it("builds optimized delivery URLs", () => {
    const url = buildDeliveryUrl("norosilk/products/sarees/demo", "productCard", "demo-cloud");
    expect(url).toContain("res.cloudinary.com/demo-cloud/image/upload/");
    expect(url).toContain(TRANSFORMATION_PRESETS.productCard);
    expect(url).toContain("norosilk/products/sarees/demo");
  });
});

describe("cloudinary folders", () => {
  it("resolves fabric-based folders", () => {
    expect(resolveUploadFolder("Pure silk")).toBe("norosilk/products/silk");
    expect(resolveUploadFolder(undefined, ALLOWED_UPLOAD_FOLDERS[0])).toBe(ALLOWED_UPLOAD_FOLDERS[0]);
  });

  it("blocks unmanaged public IDs", () => {
    expect(isManagedCloudinaryPublicId("norosilk/products/sarees/demo")).toBe(true);
    expect(isManagedCloudinaryPublicId("other/demo")).toBe(false);
  });
});

describe("upload validation", () => {
  it("rejects unsupported mime types", () => {
    const file = new File(["abc"], "demo.gif", { type: "image/gif" });
    expect(validateUploadFile(file).ok).toBe(false);
  });
});
