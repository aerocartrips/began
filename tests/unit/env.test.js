import { describe, expect, it } from "vitest";
import { validateEnv } from "@/lib/env";

const strongSecret = "s".repeat(32);

describe("validateEnv", () => {
  it("accepts an empty development environment with warnings only", () => {
    const { errors, warnings } = validateEnv({ NODE_ENV: "development" });
    expect(errors).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("requires core secrets in production", () => {
    const { errors } = validateEnv({ NODE_ENV: "production" });
    expect(errors).toEqual(
      expect.arrayContaining([
        "MONGODB_URI is required in production.",
        "JWT_SECRET is required in production.",
      ]),
    );
  });

  it("rejects short secrets and half-configured integrations", () => {
    const { errors } = validateEnv({
      NODE_ENV: "development",
      JWT_SECRET: "short",
      RAZORPAY_KEY_ID: "rzp_test_123",
      CLOUDINARY_CLOUD_NAME: "demo",
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        "JWT_SECRET must be at least 32 bytes.",
        "Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or neither.",
        "Set all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or none.",
      ]),
    );
  });

  it("passes a complete production configuration", () => {
    const { errors } = validateEnv({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://user:pass@cluster.example.net/norosilk",
      AUTH_SECRET: strongSecret,
      JWT_SECRET: `${strongSecret}a`,
      JWT_REFRESH_SECRET: `${strongSecret}b`,
      NEXT_PUBLIC_APP_URL: "https://norosilk.example",
    });
    expect(errors).toEqual([]);
  });
});
