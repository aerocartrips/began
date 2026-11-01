import { describe, expect, it, vi } from "vitest";
import { escapeRegex } from "@/lib/utils/escape-regex";
import { errorResponse, mapDatabaseError } from "@/lib/utils/api-response";
import { ApiError } from "@/lib/utils/api-error";
import { checkRateLimit, clearRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/client-ip";
import { contactMessageSchema } from "@/lib/validators/contact.validator";

describe("escapeRegex", () => {
  it("neutralises regex metacharacters", () => {
    const pattern = new RegExp(escapeRegex("(a+)+$"), "i");
    expect(pattern.test("(a+)+$")).toBe(true);
    expect(pattern.test("aaaa")).toBe(false);
  });
});

describe("mapDatabaseError", () => {
  it("maps CastError to 400", () => {
    const mapped = mapDatabaseError({ name: "CastError", path: "_id" });
    expect(mapped?.statusCode).toBe(400);
    expect(mapped?.errors).toEqual([{ field: "_id", message: "Invalid value." }]);
  });

  it("maps ValidationError to 422 with field errors", () => {
    const mapped = mapDatabaseError({
      name: "ValidationError",
      errors: { title: { path: "title", message: "Title is required." } },
    });
    expect(mapped?.statusCode).toBe(422);
    expect(mapped?.errors).toEqual([{ field: "title", message: "Title is required." }]);
  });

  it("maps duplicate keys to 409", () => {
    expect(mapDatabaseError({ code: 11000, keyValue: { sku: "A1" } })?.statusCode).toBe(409);
  });

  it("ignores unknown errors", () => {
    expect(mapDatabaseError(new Error("boom"))).toBeNull();
  });
});

describe("errorResponse", () => {
  it("logs unexpected errors and returns a request id", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = errorResponse(new Error("boom"));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.requestId).toBe(response.headers.get("x-request-id"));
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("does not log client errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = errorResponse(new ApiError(404, "Not found."));
    expect(response.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("rate limit (in-memory fallback)", () => {
  it("blocks after the configured number of hits", async () => {
    const key = `test:${Math.random()}`;
    const options = { limit: 2, windowMs: 60_000 };
    expect((await checkRateLimit(key, options)).allowed).toBe(true);
    await recordRateLimitHit(key, options);
    await recordRateLimitHit(key, options);
    const blocked = await checkRateLimit(key, options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    await clearRateLimit(key);
    expect((await checkRateLimit(key, options)).allowed).toBe(true);
  });
});

describe("getClientIpFromHeaders", () => {
  it("prefers x-real-ip and rejects malformed values", () => {
    expect(getClientIpFromHeaders(new Headers({ "x-real-ip": "10.0.0.1" }))).toBe("10.0.0.1");
    expect(getClientIpFromHeaders(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(getClientIpFromHeaders(new Headers({ "x-real-ip": "<script>" }))).toBe("unknown");
  });
});

describe("contactMessageSchema", () => {
  const valid = {
    name: "Asha",
    email: "ASHA@Example.com",
    phone: "",
    subject: "Wholesale order",
    message: "I would like a quote for 200 silk sarees.",
  };

  it("normalises a valid submission", () => {
    const parsed = contactMessageSchema.parse(valid);
    expect(parsed.email).toBe("asha@example.com");
    expect(parsed.phone).toBeNull();
  });

  it("rejects a filled honeypot", () => {
    const result = contactMessageSchema.safeParse({ ...valid, website: "spam.example" });
    expect(result.success).toBe(false);
  });

  it("reports field messages", () => {
    const result = contactMessageSchema.safeParse({ ...valid, message: "short" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["message"]);
  });
});
