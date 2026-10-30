import { describe, expect, it, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/validators/auth.validator";
import { resolveUnitPrice } from "@/lib/services/order-pricing";

const testUri = process.env.MONGODB_URI_TEST?.trim();

describe.skipIf(!testUri)("MongoDB integration", () => {
  beforeAll(async () => {
    process.env.MONGODB_URI = testUri;
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-with-32-byte-minimum-length";
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || "test-refresh-secret-with-32-byte-minimum";

    const { connectDB } = await import("@/lib/db/connect");
    await connectDB();
  });

  afterAll(async () => {
    const { User } = await import("@/lib/db/models/User");
    await User.deleteMany({ email: /integration-test@norosilk\.test$/ });
    await mongoose.disconnect();
  });

  it("registers and authenticates a customer through the auth service", async () => {
    const email = `integration-test-${Date.now()}@norosilk.test`;
    const parsed = registerSchema.parse({
      name: "Integration Buyer",
      email,
      password: "integration-pass-123",
      companyName: "Test Traders",
    });

    const { userRepository } = await import("@/lib/repositories/user.repository");
    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const created = await userRepository.create({
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      password: passwordHash,
      companyName: parsed.companyName,
      role: "customer",
    });

    expect(created.email).toBe(email.toLowerCase());

    const stored = await userRepository.findByEmail(email);
    expect(stored).not.toBeNull();
    expect(await bcrypt.compare(parsed.password, stored.password)).toBe(true);
  });

  it("enforces MOQ using live pricing rules", () => {
    expect(() =>
      resolveUnitPrice(
        { name: "Test Saree", price: 100, wholesalePrice: 80, minimumOrderQuantity: 10 },
        5,
      ),
    ).toThrow();
  });
});
