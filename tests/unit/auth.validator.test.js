import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validators/auth.validator";

describe("auth validators", () => {
  it("accepts valid registration payload", () => {
    const parsed = registerSchema.safeParse({
      name: "Wholesale Buyer",
      email: "buyer@example.com",
      password: "securepass",
      companyName: "Silk Traders",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid login payload", () => {
    const parsed = loginSchema.safeParse({ email: "not-an-email", password: "" });
    expect(parsed.success).toBe(false);
  });
});
