import { describe, expect, it } from "vitest";
import { clientErrorFromResponse, normalizeClientApiError } from "@/lib/api/api-error";
import { messageForHttpStatus, messageForNetworkError } from "@/lib/utils/error-message";
import { createAsyncActionGuard } from "@/hooks/use-async-action";

describe("error-message", () => {
  it("maps auth and validation statuses", () => {
    expect(messageForHttpStatus(401)).toMatch(/session has expired/i);
    expect(messageForHttpStatus(422)).toMatch(/check the information/i);
    expect(messageForHttpStatus(429)).toMatch(/too many requests/i);
  });

  it("hides raw internal server messages for 500", () => {
    expect(messageForHttpStatus(500, "Database exploded")).toMatch(/something went wrong/i);
  });
});

describe("api-client errors", () => {
  it("normalizes failed API envelopes", () => {
    const response = new Response(JSON.stringify({ success: false, message: "Invalid cart" }), {
      status: 422,
    });
    const error = clientErrorFromResponse(response, { success: false, message: "Invalid cart" });
    expect(error.status).toBe(422);
    expect(error.message).toBe("Invalid cart");
  });

  it("normalizes network failures", () => {
    const error = normalizeClientApiError(new TypeError("Failed to fetch"));
    expect(error.message).toMatch(/could not reach the server/i);
  });
});

describe("useAsyncAction guard", () => {
  it("prevents duplicate overlapping runs", () => {
    const guard = createAsyncActionGuard();
    expect(guard.tryBegin()).toBe(true);
    expect(guard.tryBegin()).toBe(false);
    guard.end();
    expect(guard.tryBegin()).toBe(true);
  });
});

describe("network abort copy", () => {
  it("describes aborted requests", () => {
    const error = new DOMException("Aborted", "AbortError");
    expect(messageForNetworkError(error)).toMatch(/cancelled/i);
  });
});
