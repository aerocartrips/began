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
  it("files product photos by type, then by fabric for older clients", () => {
    expect(resolveUploadFolder("Cotton", undefined, "t-shirts")).toBe("norosilk/products/t-shirts");
    expect(resolveUploadFolder("Pure silk")).toBe("norosilk/products/silk");
    expect(resolveUploadFolder(undefined)).toBe("norosilk/products");
    expect(resolveUploadFolder(undefined, ALLOWED_UPLOAD_FOLDERS[0])).toBe(ALLOWED_UPLOAD_FOLDERS[0]);
    expect(resolveUploadFolder(undefined, "norosilk/../other")).toBeNull();
  });

  it("never turns a product type value into an arbitrary folder", () => {
    for (const value of ["../avatars", "t-shirts/../../x", "T-Shirts", "a".repeat(81), "", "-x"]) {
      expect(resolveUploadFolder(undefined, undefined, value)).toBe("norosilk/products");
    }
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
