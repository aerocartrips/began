import { describe, expect, it } from "vitest";
import {
  addressWriteSchema,
  changePasswordSchema,
  normalizePhone,
  preferencesSchema,
  profileUpdateSchema,
  savedAddressSchema,
} from "@/lib/validators/account.validator";
import { createOrderSchema } from "@/lib/validators/order.validator";

const address = {
  fullName: "Asha Rao",
  phone: "9876543210",
  addressLine1: "12 Weavers Lane",
  city: "Kanchipuram",
  state: "Tamil Nadu",
  pincode: "631501",
};

describe("phone normalization", () => {
  it("normalizes Indian mobiles to 10 digits", () => {
    for (const value of ["9876543210", "+91 98765 43210", "+91-98765-43210", "0 98765-43210"]) {
      expect(normalizePhone(value)).toBe("9876543210");
    }
  });

  it("accepts E.164 international numbers unless India is required", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("+44 20 7946 0958", { indiaOnly: true })).toBeNull();
  });

  it("rejects malformed numbers", () => {
    for (const value of ["12345", "5876543210", "abcdefghij", "+0123456789"]) {
      expect(normalizePhone(value)).toBeNull();
    }
  });
});

describe("saved addresses", () => {
  it("canonicalizes state names and defaults label and country", () => {
    const parsed = savedAddressSchema.parse({ ...address, state: "TAMIL NADU" });
    expect(parsed).toMatchObject({ state: "Tamil Nadu", country: "India", label: "home", landmark: "", gstin: "" });
  });

  it("rejects invalid Indian PIN codes", () => {
    for (const pincode of ["031501", "63150", "6315012", "ABC123"]) {
      expect(savedAddressSchema.safeParse({ ...address, pincode }).success).toBe(false);
    }
  });

  it("validates GSTIN format and uppercases it", () => {
    expect(savedAddressSchema.parse({ ...address, gstin: "33aabcr1234f1z5" }).gstin).toBe("33AABCR1234F1Z5");
    expect(savedAddressSchema.safeParse({ ...address, gstin: "33AABCR1234F1Y5" }).success).toBe(false);
  });

  it("strips fields that are not part of an address", () => {
    const parsed = addressWriteSchema.parse({ ...address, user: "someone-else", _id: "x", isDefault: true });
    expect(parsed).not.toHaveProperty("user");
    expect(parsed).not.toHaveProperty("_id");
    expect(parsed).not.toHaveProperty("isDefault");
  });
});

describe("profile and preferences", () => {
  it("drops non-editable fields such as role and email", () => {
    const parsed = profileUpdateSchema.parse({ firstName: "Asha", role: "admin", email: "x@y.z", isActive: false });
    expect(parsed).toEqual({ firstName: "Asha" });
  });

  it("requires at least one known field", () => {
    expect(profileUpdateSchema.safeParse({ role: "admin" }).success).toBe(false);
    expect(preferencesSchema.safeParse({ marketing: true }).success).toBe(false);
    expect(preferencesSchema.parse({ promotional: false })).toEqual({ promotional: false });
  });
});

describe("password policy", () => {
  const base = { currentPassword: "Old-pass-123" };

  it("requires length, a letter and a number", () => {
    for (const newPassword of ["short1", "lettersonly", "1234567890"]) {
      expect(changePasswordSchema.safeParse({ ...base, newPassword, confirmPassword: newPassword }).success).toBe(false);
    }
    expect(changePasswordSchema.safeParse({ ...base, newPassword: "Silk-weave-2025", confirmPassword: "Silk-weave-2025" }).success).toBe(true);
  });

  it("rejects mismatched confirmation and reuse of the current password", () => {
    const mismatch = changePasswordSchema.safeParse({ ...base, newPassword: "Silk-weave-2025", confirmPassword: "Silk-weave-2026" });
    expect(mismatch.error?.issues.map((issue) => issue.path.join("."))).toEqual(["confirmPassword"]);
    const reused = changePasswordSchema.safeParse({ ...base, newPassword: base.currentPassword, confirmPassword: base.currentPassword });
    expect(reused.error?.issues.map((issue) => issue.path.join("."))).toEqual(["newPassword"]);
  });
});

describe("checkout address payload", () => {
  const items = [{ productId: "p1", quantity: 1 }];

  it("accepts a saved address id or a full address", () => {
    expect(createOrderSchema.safeParse({ items, shippingAddressId: "abc" }).success).toBe(true);
    expect(createOrderSchema.safeParse({ items, shippingAddress: address }).success).toBe(true);
  });

  it("requires exactly one shipping source and at most one billing source", () => {
    expect(createOrderSchema.safeParse({ items }).success).toBe(false);
    expect(createOrderSchema.safeParse({ items, shippingAddressId: "abc", shippingAddress: address }).success).toBe(false);
    expect(
      createOrderSchema.safeParse({ items, shippingAddressId: "abc", billingAddressId: "def", billingAddress: address }).success,
    ).toBe(false);
  });
});
