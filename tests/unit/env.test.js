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

  it("rejects short secrets, bad encryption keys and half-configured integrations", () => {
    const { errors } = validateEnv({
      NODE_ENV: "development",
      JWT_SECRET: "short",
      TENANT_SECRETS_KEY: "not-32-bytes",
      CLOUDINARY_CLOUD_NAME: "demo",
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        "JWT_SECRET must be at least 32 bytes.",
        "TENANT_SECRETS_KEY must be 32 random bytes, base64-encoded.",
        "Set all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or none.",
      ]),
    );
  });

  it("warns about settings that moved to per-store configuration", () => {
    const { warnings } = validateEnv({ NODE_ENV: "development", RAZORPAY_KEY_ID: "rzp_test_123" });
    expect(warnings.some((warning) => warning.startsWith("RAZORPAY_KEY_ID is no longer read"))).toBe(true);
  });

  it("passes a complete production configuration", () => {
    const { errors } = validateEnv({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://user:pass@cluster.example.net/norosilk",
      AUTH_SECRET: strongSecret,
      JWT_SECRET: `${strongSecret}a`,
      JWT_REFRESH_SECRET: `${strongSecret}b`,
      TENANT_SECRETS_KEY: Buffer.alloc(32, 1).toString("base64"),
      NEXT_PUBLIC_APP_URL: "https://norosilk.example",
    });
    expect(errors).toEqual([]);
  });
});
