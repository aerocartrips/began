import { describe, expect, it } from "vitest";
import { authHref, isAuthPath, isProtectedPath, returnPathFor, safeRedirectPath } from "@/lib/auth/redirect";

describe("safeRedirectPath", () => {
  it("keeps in-store paths with their query and hash", () => {
    expect(safeRedirectPath("/products?category=silk&sort=new#reviews")).toBe("/products?category=silk&sort=new#reviews");
    expect(safeRedirectPath("/checkout?intent=buy-now")).toBe("/checkout?intent=buy-now");
  });

  it.each([
    ["//evil.example/path"],
    ["/\\evil.example"],
    ["https://evil.example"],
    ["javascript:alert(1)"],
    ["evil.example"],
    ["/\t/evil.example"],
    [""],
    [null],
    [undefined],
  ])("rejects %s", (value) => {
    expect(safeRedirectPath(value, "/fallback")).toBe("/fallback");
  });

  it("never returns to the sign-in pages or API routes", () => {
    expect(safeRedirectPath("/account/login?next=/checkout")).toBe("/");
    expect(safeRedirectPath("/account/register/")).toBe("/");
    expect(safeRedirectPath("/api/v1/account/export")).toBe("/");
  });

  it("rejects absurdly long values", () => {
    expect(safeRedirectPath(`/${"a".repeat(3000)}`)).toBe("/");
  });
});

describe("authHref", () => {
  it("carries the destination as `next`, omitting the home page", () => {
    expect(authHref("/account/orders")).toBe("/account/login?next=%2Faccount%2Forders");
    expect(authHref("/")).toBe("/account/login");
    expect(authHref(null)).toBe("/account/login");
    expect(authHref("//evil.example")).toBe("/account/login");
    expect(authHref("/checkout", "/account/register")).toBe("/account/register?next=%2Fcheckout");
  });
});

describe("returnPathFor", () => {
  it("returns to the current page with its filters", () => {
    expect(returnPathFor("/products", new URLSearchParams("category=silk"))).toBe("/products?category=silk");
  });

  it("keeps the pending destination while on the sign-in pages", () => {
    expect(returnPathFor("/account/login", new URLSearchParams("next=/checkout"))).toBe("/checkout");
    expect(returnPathFor("/account/register", new URLSearchParams())).toBe("/");
  });
});

describe("protected and auth paths", () => {
  it("treats the account area as protected, except the public account pages", () => {
    expect(isProtectedPath("/account")).toBe(true);
    expect(isProtectedPath("/account/orders/123")).toBe(true);
    expect(isProtectedPath("/account/login")).toBe(false);
    expect(isProtectedPath("/account/register")).toBe(false);
    expect(isProtectedPath("/account/verify-email")).toBe(false);
    expect(isProtectedPath("/accounts")).toBe(false);
    expect(isProtectedPath("/cart")).toBe(false);
  });

  it("protects checkout, so shoppers sign in before filling in their details", () => {
    expect(isProtectedPath("/checkout")).toBe(true);
    expect(isProtectedPath("/checkout/")).toBe(true);
    expect(isProtectedPath("/checkout/confirmation")).toBe(true);
    expect(isProtectedPath("/checkouts")).toBe(false);
  });

  it("recognises the sign-in pages with or without a trailing slash", () => {
    expect(isAuthPath("/account/login")).toBe(true);
    expect(isAuthPath("/account/login/")).toBe(true);
    expect(isAuthPath("/account")).toBe(false);
  });
});
